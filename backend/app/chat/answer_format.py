"""LLM 답변 서식 후처리 — 인라인 출처 표시 [n], 마크다운 굵게(**), 후속 질문(<followups>).

숫자 검증기(number_validator)는 출처 번호 [1]을 근거 없는 숫자로, 굵게 표시 **를 거듭제곱 기호로 볼 수 있다.
그래서 검증 전에 둘을 숫자 없는 자리표시로 바꿔 두고(protect), 검증·마스킹 뒤에 되돌린다(restore).
출처 번호는 실제 넘긴 발췌 수(1..n) 안의 것만 남기고 나머지는 지운다.
"""

import re
from dataclasses import dataclass, field

CITE_RE = re.compile(r"\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]")
AI_MARK = "[AI]"  # 자료 근거 없이 LLM이 일반 지식으로 보충한 부분 (숫자가 없어 검증기를 그대로 통과한다)
_BOLD = "**"
_CITE_MARK = ""  # 사용자 영역 문자 — 숫자·기호 검사에 걸리지 않는다
_BOLD_MARK = ""
_FOLLOWUPS_RE = re.compile(r"<followups>(.*?)(?:</followups>|$)", re.S | re.I)
_MAX_FOLLOWUPS = 3


@dataclass
class Protected:
    text: str
    cites: list[list[int]] = field(default_factory=list)  # 자리표시 순서대로 출처 번호 묶음


def split_followups(text: str) -> tuple[str, list[str]]:
    """본문과 후속 질문(최대 3개). <followups> 안의 '- 질문' 줄을 질문으로 본다."""
    m = _FOLLOWUPS_RE.search(text)
    if not m:
        return text.strip(), []
    items = [re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", line).strip() for line in m.group(1).splitlines()]
    body = (text[: m.start()] + text[m.end():]).strip()
    return body, [q for q in items if q][:_MAX_FOLLOWUPS]


def protect(text: str, n_sources: int) -> Protected:
    """출처 번호 묶음과 ** 를 자리표시로 바꾼다. 범위 밖 번호는 버린다(남는 번호가 없으면 표시 자체를 지운다)."""
    cites: list[list[int]] = []

    def cite(m: re.Match) -> str:
        nums = list(dict.fromkeys(int(x) for x in re.split(r"\s*,\s*", m.group(1))))
        nums = [x for x in nums if 1 <= x <= n_sources]
        if not nums:
            return ""
        cites.append(nums)
        return _CITE_MARK

    out = CITE_RE.sub(cite, text) if n_sources else CITE_RE.sub("", text)
    return Protected(out.replace(_BOLD, _BOLD_MARK), cites)


def restore(text: str, protected: Protected) -> str:
    cites = iter(protected.cites)
    out = re.sub(_CITE_MARK, lambda _: "[" + ",".join(map(str, next(cites, []))) + "]", text)
    out = out.replace("[]", "").replace(_BOLD_MARK, _BOLD)
    return re.sub(r"[ \t]+\n", "\n", out).strip()
