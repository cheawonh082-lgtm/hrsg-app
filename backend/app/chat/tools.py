"""LLM 도구 (PRD §4.5). 정의는 공급자 중립 JSON Schema — 실제 LLM 연결 시 tool use에 그대로 넘긴다.

G-7: 계산 도구가 LLM에 돌려주는 값은 최종값(LLM_VISIBLE_PATHS)뿐이다. 중간 계수·감도 곡선은 넘기지 않는다.
"""

from app.calculator.base import CalculatorService
from app.calculator.result_cache import CalcResultCache
from app.domain.models.calc import CalcInput, CalcResult, Locale
from app.domain.models.chat import Citation
from app.guardrails.number_validator import resolve_path
from app.guardrails.redactor import Redactor
from app.rag.retriever import Retriever

SNIPPET_MAX = 300

# LLM이 {{calc.<path>}} 토큰으로 쓸 수 있는 최종값 경로
LLM_VISIBLE_PATHS = (
    "current.fouling_index",
    "loss.gt_power_loss_mw",
    "loss.st_power_loss_mw",
    "loss.total_power_loss_mw",
    "loss.heat_rate_increase_pct",
    "loss.annual_revenue_loss_krw",
    "recovery.recovered_power_mw",
    "recovery.annual_recovery_krw",
    "recovery.recovery_rate_pct",
    "recovery.expected_dp_after_mbar",
    "recovery.expected_stack_temp_after_c",
)


def tool_definitions() -> list[dict]:
    return [
        {
            "name": "calculate_performance",
            "description": "HRSG 오염에 따른 성능 손실, 세정 회수 효과, 공법별 비용을 내부 계산기로 계산한다. "
            "수치 질문에는 반드시 이 도구를 사용한다.",
            "input_schema": CalcInput.model_json_schema(by_alias=True),
        },
        {
            "name": "search_knowledge",
            "description": "마스킹된 기술 자료에서 근거를 검색한다.",
            "input_schema": {
                "type": "object",
                "properties": {"query": {"type": "string"}, "top_k": {"type": "integer", "default": 5}},
                "required": ["query"],
            },
        },
    ]


def calculate_performance(calculator: CalculatorService, cache: CalcResultCache, inp: CalcInput) -> CalcResult:
    result = calculator.evaluate(inp)
    cache.put(result)  # 카드의 "계산기에서 열기"가 같은 calcId로 복원할 수 있도록
    return result


def values_for_llm(result: CalcResult) -> dict[str, float]:
    values = {}
    for path in LLM_VISIBLE_PATHS:
        value = resolve_path(result, path)
        if value is not None:
            values[path] = value
    return values


def search_knowledge(
    retriever: Retriever, redactor: Redactor, query: str, locale: Locale, top_k: int = 3
) -> list[Citation]:
    return [
        Citation(
            doc_alias=hit.chunk.doc_alias,
            section_title=hit.chunk.section_title,
            snippet=_truncate(redactor.redact(hit.chunk.text).text),
            score=hit.score,
        )
        for hit in retriever.search(query, top_k=top_k, lang=locale)
    ]


def _truncate(text: str) -> str:
    return text if len(text) <= SNIPPET_MAX else text[: SNIPPET_MAX - 1].rstrip() + "…"
