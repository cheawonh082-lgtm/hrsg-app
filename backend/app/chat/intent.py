"""의도 분류 (PRD §4.5): LLM 판단 + 규칙 기반 보조. 둘 중 하나라도 계산이면 계산 경로(보수적 라우팅)."""

import re

from app.domain.models.chat import ChatIntent

_CALC_CUES = re.compile(
    r"얼마|손실|계산|비용|회수|경제성|돈|원\b|금액|payback|how much|loss|cost|calculate|estimate|saving|"
    r"\d+(?:\.\d+)?\s*(?:mbar|℃|°C|%|MW)",
    re.IGNORECASE,
)
# 계산기에서 넘어온 맥락이 있을 때만 계산 질문으로 보는 표현 ("이 결과 해석해줘")
_CONTEXT_CALC_CUES = re.compile(r"결과|해석|이 값|이대로|result|interpret|these numbers", re.IGNORECASE)
_KNOWLEDGE_CUES = re.compile(
    r"란\b|이란|뭐|무엇|무슨|왜|영향|원인|정의|원리|어떻게|설명|사례|알려|차이|방법|종류|"
    r"\bwhat\b|\bwhy\b|\bhow\b|explain|define|effect|impact|cause|example|difference|method",
    re.IGNORECASE,
)


def classify(llm_intent: ChatIntent, message: str, has_calc_context: bool) -> ChatIntent:
    calc = llm_intent in ("calculation", "mixed") or bool(_CALC_CUES.search(message))
    calc = calc or (has_calc_context and bool(_CONTEXT_CALC_CUES.search(message)))
    knowledge = llm_intent in ("knowledge", "mixed") or bool(_KNOWLEDGE_CUES.search(message))
    if calc and knowledge:
        return "mixed"
    if calc:
        return "calculation"
    if knowledge:
        return "knowledge"
    return "out_of_scope"
