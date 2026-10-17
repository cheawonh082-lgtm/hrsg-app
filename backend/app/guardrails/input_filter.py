"""입력 필터 (PRD §4.5, §5) — LLM에 보내기 전에 규칙으로 걸러낸다.

- injection: 이전 지시 무시·시스템 프롬프트·원문 전체 출력 시도 → intent='blocked'
- confidential: 계산 공식·계수·내부 로직, 원문 파일 요청 → 정중한 거절(notice)
"""

import re
from dataclasses import dataclass
from typing import Literal

_INJECTION = [
    r"(이전|위|앞|기존)의?\s*(모든\s*)?(지시|지침|명령|규칙|프롬프트).{0,6}(무시|잊어|따르지)",
    r"ignore\s+(all\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions|prompts?|rules)",
    r"disregard\s+(all\s+)?(previous|prior|above)",
    r"(시스템|system)\s*(프롬프트|prompt)",
    r"(원문|전문|문서)\s*(전체|전부|그대로|통째로)",
    r"(full|entire|whole|raw)\s+(text|document|source)",
    r"(너는|you are)\s*(이제|now)\b",
    r"jailbreak|developer mode|DAN\b",
]
_CONFIDENTIAL = [
    r"(공식(?!적)|수식|계수|알고리즘|내부\s*로직)",
    r"\b(formula|equation|coefficient|constants?|algorithm|internal logic)s?\b",
    r"(원문|원본)\s*(파일|문서)?\s*(경로|이름|파일명|다운로드|열어|보여)",
    r"(file\s*name|file\s*path|download)\b.*\b(document|source|file)",
]
_INJECTION_RE = [re.compile(p, re.IGNORECASE) for p in _INJECTION]
_CONFIDENTIAL_RE = [re.compile(p, re.IGNORECASE) for p in _CONFIDENTIAL]


@dataclass(frozen=True)
class FilterResult:
    verdict: Literal["ok", "injection", "confidential"]
    reason: str | None = None


def check_input(message: str) -> FilterResult:
    for pattern in _INJECTION_RE:
        if pattern.search(message):
            return FilterResult("injection", "prompt_injection")
    for pattern in _CONFIDENTIAL_RE:
        if pattern.search(message):
            return FilterResult("confidential", "confidential_request")
    return FilterResult("ok")
