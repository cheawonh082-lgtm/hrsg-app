"""숫자 출처 검증 (PRD §4.5 G-2, G-3, G-6).

LLM 초안의 수치는 `{{calc.<path>}}` 토큰으로만 허용한다.
1) 토큰 밖의 리터럴 숫자를 허용 집합(사용자 입력·인용 발췌·계산 결과·허용 상수)과 대조해 불일치는 제거한다.
2) 남은 토큰을 CalcResult 값으로 치환한다(서버 포맷). 알 수 없는 토큰도 제거한다.
3) 수식 패턴(공식·계수 유출 의심)이 있으면 텍스트 전체를 막는다.
"""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal

from app.domain.models.calc import CalcResult, Locale

TOKEN_RE = re.compile(r"\{\{\s*calc\.([a-z0-9_.]+)\s*\}\}")
# 식별자 일부(TECH-DOC-017, HP_SH, x2)는 숫자로 보지 않는다
NUMBER_RE = re.compile(r"(?<![A-Za-z0-9_.\-])\d[\d,]*(?:\.\d+)?")
_FORMULA_RE = re.compile(r"[A-Za-z가-힣_)\]]\s*(?:=|×|\^|\*\*)\s*[A-Za-z0-9가-힣_(]")

_REPLACEMENT: dict[Locale, str] = {"ko": "(계산 결과 카드 참조)", "en": "(see the result card)"}
_SMALL_INTEGERS = {float(n) for n in range(0, 11)}  # 목록 번호·단계 수 등


@dataclass(frozen=True)
class NumberCheck:
    text: str
    status: Literal["passed", "sanitized", "not_applicable"]
    removed: list[str]
    formula_blocked: bool = False


def numbers_in(texts: Iterable[str]) -> set[float]:
    found: set[float] = set()
    for text in texts:
        for m in NUMBER_RE.finditer(text):
            value = _to_float(m.group(0))
            if value is not None:
                found.add(value)
    return found


def check_numbers(
    draft: str,
    locale: Locale,
    result: CalcResult | None = None,
    allowed_literals: Iterable[float] = (),
    allowed_paths: Iterable[str] | None = None,
) -> NumberCheck:
    """allowed_paths: 치환을 허용할 토큰 경로(None이면 결과의 모든 숫자 경로)."""
    paths = set(allowed_paths) if allowed_paths is not None else None
    if _FORMULA_RE.search(TOKEN_RE.sub("", draft)):
        return NumberCheck("", "sanitized", [], formula_blocked=True)

    allowed = set(allowed_literals) | _SMALL_INTEGERS | _result_values(result)
    removed: list[str] = []

    # 1) 토큰 밖 리터럴 숫자 검사 (토큰은 자리표시로 보호)
    parts = TOKEN_RE.split(draft)  # 짝수 인덱스: 일반 텍스트, 홀수 인덱스: 토큰 경로
    for i in range(0, len(parts), 2):
        parts[i] = NUMBER_RE.sub(lambda m: _keep_or_drop(m.group(0), allowed, removed, locale), parts[i])

    # 2) 토큰 치환
    for i in range(1, len(parts), 2):
        permitted = paths is None or parts[i] in paths
        value = resolve_path(result, parts[i]) if result and permitted else None
        if value is None:
            removed.append("{{calc.%s}}" % parts[i])
            parts[i] = _REPLACEMENT[locale]
        else:
            parts[i] = format_value(parts[i], value, locale)

    has_numbers = bool(removed) or bool(TOKEN_RE.search(draft)) or bool(NUMBER_RE.search(draft))
    status = "sanitized" if removed else ("passed" if has_numbers else "not_applicable")
    return NumberCheck("".join(parts), status, removed)


def format_value(path: str, value: float, locale: Locale) -> str:
    key = path.rsplit(".", 1)[-1]
    if key.endswith("_krw"):
        return _format_krw(value, locale)
    for suffix, unit in _UNITS:
        if key.endswith(suffix):
            return f"{_format_number(value, 1)}{unit}"
    return _format_number(value, 1)


# ---- 내부 ----
_UNITS = [
    ("_mw", " MW"), ("_pct", "%"), ("_c", " ℃"), ("_mbar", " mbar"), ("_kg_s", " kg/s"),
    ("_days", ""), ("_months", ""), ("fouling_index", " / 100"),
]


def _format_number(value: float, digits: int) -> str:
    text = f"{value:,.{digits}f}"
    return text.rstrip("0").rstrip(".") if "." in text else text


def _format_krw(value: float, locale: Locale) -> str:
    if locale == "ko":
        if abs(value) >= 1e8:
            return f"{_format_number(value / 1e8, 1)}억 원"
        if abs(value) >= 1e4:
            return f"{_format_number(value / 1e4, 0)}만 원"
        return f"{_format_number(value, 0)} 원"
    if abs(value) >= 1e9:
        return f"{_format_number(value / 1e9, 2)}B KRW"
    if abs(value) >= 1e6:
        return f"{_format_number(value / 1e6, 1)}M KRW"
    return f"{_format_number(value, 0)} KRW"


def resolve_path(result: CalcResult, path: str) -> float | None:
    node: object = result.model_dump(by_alias=False)
    for part in path.split("."):
        if isinstance(node, dict) and part in node:
            node = node[part]
        elif isinstance(node, list) and part.isdigit() and int(part) < len(node):
            node = node[int(part)]
        else:
            return None
    if isinstance(node, bool) or not isinstance(node, int | float):
        return None
    return float(node)


def _result_values(result: CalcResult | None) -> set[float]:
    """계산 결과의 숫자(반올림 변형 포함). LLM이 토큰 대신 같은 값을 직접 써도 허용."""
    if result is None:
        return set()
    values: set[float] = set()

    def walk(node: object) -> None:
        if isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
        elif isinstance(node, int | float) and not isinstance(node, bool):
            for digits in (0, 1, 2):
                values.add(round(float(node), digits))

    walk(result.model_dump(by_alias=False, exclude={"sensitivity"}))
    return values


def _keep_or_drop(raw: str, allowed: set[float], removed: list[str], locale: Locale) -> str:
    value = _to_float(raw)
    if value is None or value in allowed or _is_year(value):
        return raw
    removed.append(raw)
    return _REPLACEMENT[locale]


def _is_year(value: float) -> bool:
    return value.is_integer() and 1900 <= value <= 2100


def _to_float(raw: str) -> float | None:
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return None
