"""결정적 Fake LLM — 실제 LLM 연결 전 개발·테스트용 (PRD §6.4 FakeLLMProvider).

- extract: 정규식으로 'F급', '차압 35mbar', '스택 110℃', '부하 80%' 같은 값을 뽑는다.
- compose: 의도·언어별 고정 템플릿. 수치는 토큰으로만 쓴다.
- inject_literal: 테스트에서 리터럴 숫자를 일부러 섞어 검증기 동작을 확인한다(A-08).
"""

import re

from app.chat.llm.base import ComposeContext, Extraction, LLMProvider
from app.domain.models.calc import GasTurbineSpec, Locale

_NUM = r"(\d+(?:\.\d+)?)"
_VALUE = re.compile(_NUM + r"\s*(mbar|℃|°C|도|%|퍼센트)", re.IGNORECASE)
_MODEL = re.compile(r"\b([A-Z])\s*(?:급|-?\s*class)", re.IGNORECASE)
_CLAUSE_BREAK = re.compile(r"[,，;、\n]|그리고|and ")

# (단위, 앞쪽 키워드 정규식, 필드) — 같은 절 안의 키워드로 어떤 입력인지 판단한다
_FIELD_RULES: list[tuple[str, re.Pattern, str]] = [
    ("mbar", re.compile(r"배압|back\s*pressure", re.I), "gtBackPressureMbar"),
    ("mbar", re.compile(r"차압|ΔP|\bdp\b|pressure\s*drop|압력\s*손실|압손", re.I), "hrsgGasDpMbar"),
    ("temp", re.compile(r"스택|굴뚝|stack", re.I), "stackTempC"),
    ("temp", re.compile(r"배기|exhaust", re.I), "exhaustTempC"),
    ("temp", re.compile(r"외기|대기|ambient", re.I), "ambientTempC"),
    ("pct", re.compile(r"부하|load", re.I), "gtLoadPct"),
]


class FakeLLMProvider(LLMProvider):
    name = "fake"

    def __init__(self, inject_literal: str | None = None):
        self._inject_literal = inject_literal

    # ---- 파라미터 추출 ----
    def extract(self, message: str, locale: Locale, gt_models: list[GasTurbineSpec]) -> Extraction:
        params: dict = {}
        model_id = _match_model(message, gt_models)
        if model_id:
            params["gtModelId"] = model_id
        condition = _match_condition(message)
        if condition:
            params["condition"] = condition
        # Fake는 파라미터가 있으면 계산, 없으면 판단 보류 — 지식형 여부는 규칙 기반 판단(intent.py)에 맡긴다
        return Extraction(intent="calculation" if params else "out_of_scope", params=params)

    # ---- 서술 생성 ----
    def compose(self, ctx: ComposeContext) -> str:
        parts: list[str] = []
        if ctx.calc_values is not None:
            parts.append(_CALC_TEXT[ctx.locale])
            if ctx.used_defaults:
                parts.append(_DEFAULTS_TEXT[ctx.locale])
        if ctx.intent in ("knowledge", "mixed"):
            parts.append(_knowledge_text(ctx))
        if self._inject_literal:
            parts.append(_INJECT_TEXT[ctx.locale].format(value=self._inject_literal))
        return "\n\n".join(parts)


def _match_model(message: str, gt_models: list[GasTurbineSpec]) -> str | None:
    m = _MODEL.search(message)
    if not m:
        return None
    letter = m.group(1).upper()
    for model in gt_models:
        if f"_{letter}_CLASS" in model.model_id or model.display_name.upper().startswith(f"{letter}-CLASS"):
            return model.model_id
    return None


def _match_condition(message: str) -> dict[str, float]:
    found: dict[str, float] = {}
    for m in _VALUE.finditer(message):
        unit = m.group(2).lower()
        kind = "mbar" if unit == "mbar" else "pct" if unit in ("%", "퍼센트") else "temp"
        clause = _CLAUSE_BREAK.split(message[: m.start()])[-1]
        field = next((f for k, kw, f in _FIELD_RULES if k == kind and kw.search(clause)), None)
        if field is None and kind == "mbar":
            field = "hrsgGasDpMbar"  # 키워드 없는 mbar 값은 HRSG 차압으로 본다
        if field and field not in found:
            found[field] = float(m.group(1))
    return found


def _knowledge_text(ctx: ComposeContext) -> str:
    """실제 LLM과 같은 서식: 굵게 시작하는 결론 문단 + 나머지 발췌 목록, 문단 끝 출처 번호 [n], 후속 질문."""
    if not ctx.citations:
        return _NOT_FOUND_TEXT[ctx.locale]
    first = lambda c: " ".join(re.split(r"(?<=[.다])\s+", c.snippet)[:2]).strip()  # noqa: E731
    parts = [_KNOWLEDGE_TEXT[ctx.locale].format(snippet=first(ctx.citations[0]))]
    rest = [f"- {first(c)} [{i}]" for i, c in enumerate(ctx.citations[1:3], start=2)]
    if rest:
        parts.append(_RELATED_HEADING[ctx.locale] + "\n\n" + "\n".join(rest))
    parts.append("<followups>\n" + "\n".join(f"- {q}" for q in _FOLLOW_UPS[ctx.locale]) + "\n</followups>")
    return "\n\n".join(parts)


_CALC_TEXT: dict[Locale, str] = {
    "ko": (
        "입력하신 조건의 계산 결과, 총 출력 손실은 {{calc.loss.total_power_loss_mw}}이고 "
        "연간 손실액은 {{calc.loss.annual_revenue_loss_krw}}입니다. "
        "세정하면 연간 약 {{calc.recovery.annual_recovery_krw}}의 회수가 예상됩니다. "
        "공법별 비교와 상세 값은 결과 카드에서 확인하세요."
    ),
    "en": (
        "Under the given conditions, the total power loss is {{calc.loss.total_power_loss_mw}} "
        "and the annual loss is {{calc.loss.annual_revenue_loss_krw}}. "
        "Cleaning is expected to recover {{calc.recovery.annual_recovery_krw}} per year. "
        "See the result card for method comparison and details."
    ),
}
_DEFAULTS_TEXT: dict[Locale, str] = {
    "ko": "질문에 없던 입력은 모델 기본값을 사용했습니다. 카드의 가정 목록을 확인하고 필요하면 수정하세요.",
    "en": "Inputs not given in the question use model defaults. Check the assumptions on the card and edit if needed.",
}
_KNOWLEDGE_TEXT: dict[Locale, str] = {
    "ko": "**자료에 따르면** — {snippet} [1]",
    "en": "**According to the reference material:** {snippet} [1]",
}
_RELATED_HEADING: dict[Locale, str] = {"ko": "## 관련 자료", "en": "## Related material"}
_FOLLOW_UPS: dict[Locale, list[str]] = {
    "ko": ["세정 공법별 차이를 알려 주세요.", "성능 저하는 어떻게 확인하나요?", "점검할 때 무엇을 봐야 하나요?"],
    "en": ["How do the cleaning methods differ?", "How can I tell performance is degrading?", "What should I check during inspection?"],
}
_NOT_FOUND_TEXT: dict[Locale, str] = {
    "ko": "관련 내용을 자료에서 확인하지 못했습니다.",
    "en": "This could not be confirmed in the reference material.",
}
_INJECT_TEXT: dict[Locale, str] = {
    "ko": "참고로 예상 손실은 약 {value} MW입니다.",
    "en": "For reference, the expected loss is about {value} MW.",
}
