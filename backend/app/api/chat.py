from fastapi import APIRouter, Depends

from app.calculator.base import CalculatorService
from app.calculator.reference_data.provider import ReferenceDataProvider
from app.calculator.registry import get_calculator, get_reference_data, get_result_cache
from app.calculator.result_cache import CalcResultCache
from app.chat.llm.base import LLMProvider
from app.chat.orchestrator import Orchestrator
from app.chat.registry import get_llm, get_retriever
from app.domain.models.chat import ChatRequest, ChatResponse
from app.guardrails.redactor import Redactor
from app.guardrails.registry import get_redactor
from app.rag.retriever import Retriever

router = APIRouter(prefix="/api", tags=["chat"])


def get_orchestrator(
    llm: LLMProvider = Depends(get_llm),
    calculator: CalculatorService = Depends(get_calculator),
    data: ReferenceDataProvider = Depends(get_reference_data),
    cache: CalcResultCache = Depends(get_result_cache),
    retriever: Retriever = Depends(get_retriever),
    redactor: Redactor = Depends(get_redactor),
) -> Orchestrator:
    return Orchestrator(llm, calculator, data, cache, retriever, redactor)


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, orchestrator: Orchestrator = Depends(get_orchestrator)):
    # SSE(PRD Should)는 추후: 응답이 블록 단위라 블록별 이벤트로 그대로 나눠 보낼 수 있다
    return orchestrator.handle(req)
