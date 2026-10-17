"""고객사·발전소 실명 마스킹 (PRD §5). 인제스트 시점과 응답 출력 시점에 이중 적용한다.

1) 사전: 실명 → 별칭 (secrets/redaction_dict.yaml, 없으면 Mock 사전)
2) 정규식: 사전에 없는 '○○발전소', '○○화력', 'N호기' 등 패턴 → 일반 별칭
"""

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

MOCK_DICT_PATH = Path(__file__).with_name("mock_redaction_dict.yaml")

# 사전에 없는 발전소 이름 패턴: 고유명 + 접미사. 별칭(PLANT-*)은 대상이 아니다.
_PLANT_PATTERNS = [
    re.compile(r"(?P<name>[가-힣]{2,10}?)(?:복합화력|복합|화력|발전본부|발전소)"),
    re.compile(r"\b(?P<name>[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)*) (?:Power (?:Station|Plant)|CCPP)\b"),
]
# 고유명이 아닌 일반 명사(예: '복합화력 발전소', 'Combined Cycle Power Plant')는 마스킹하지 않는다
_GENERIC_NAMES = {
    "복합", "석탄", "가스", "원자력", "열병합", "수력", "양수", "태양광", "풍력", "해당", "일반", "국내",
    "해외", "대형", "소형", "신규", "기존", "다른", "모든", "우리", "귀사", "고객", "대상", "인근",
    "Combined Cycle", "Gas", "Coal", "Nuclear", "Thermal", "The", "A", "Our", "Your", "Each", "Any",
}
_UNIT_PATTERN = re.compile(r"(?<![\w-])\d{1,2}\s?호기")
_GENERIC_PLANT = "PLANT-X"
_GENERIC_UNIT = "UNIT-X"


@dataclass(frozen=True)
class RedactionResult:
    text: str
    count: int


class Redactor:
    def __init__(self, mapping: dict[str, str]):
        # 긴 이름부터 치환해야 '가상그린복합'보다 '가상그린복합화력'이 먼저 잡힌다
        self._mapping = sorted(mapping.items(), key=lambda kv: len(kv[0]), reverse=True)

    @classmethod
    def from_file(cls, path: Path) -> "Redactor":
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        mapping: dict[str, str] = {}
        for group in data.values():
            if isinstance(group, dict):
                mapping.update({str(k): str(v) for k, v in group.items()})
        return cls(mapping)

    @classmethod
    def load(cls, secrets_dir: Path) -> "Redactor":
        real = secrets_dir / "redaction_dict.yaml"
        return cls.from_file(real if real.is_file() else MOCK_DICT_PATH)

    def redact(self, text: str) -> RedactionResult:
        count = 0
        for name, alias in self._mapping:
            if name in text:
                count += text.count(name)
                text = text.replace(name, alias)
        replaced = 0

        def replace_plant(m: re.Match) -> str:
            nonlocal replaced
            if m.group("name") in _GENERIC_NAMES:
                return m.group(0)
            replaced += 1
            return _GENERIC_PLANT

        for pattern in _PLANT_PATTERNS:
            text = pattern.sub(replace_plant, text)
        text, n = _UNIT_PATTERN.subn(_GENERIC_UNIT, text)
        return RedactionResult(text, count + replaced + n)
