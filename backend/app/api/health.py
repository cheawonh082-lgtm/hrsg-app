from typing import Literal

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.domain.models.base import CamelModel
from app.rag.store import resolve_docs_dir

router = APIRouter(prefix="/api", tags=["health"])


class HealthStatus(CamelModel):
    engine: Literal["mock", "real"]
    data_source: Literal["mock", "real"]
    llm: str
    docs: Literal["mock", "real"]  # RAG 문서: 내장 Mock 문서 또는 인제스트된 실제 문서
    is_mock: bool  # 계산 엔진 또는 데이터 중 하나라도 Mock이면 true → UI MOCK 배너


@router.get("/health", response_model=HealthStatus)
def health(settings: Settings = Depends(get_settings)):
    _, docs_mock = resolve_docs_dir(settings.docs_masked_dir)
    return HealthStatus(
        engine=settings.calc_engine,
        data_source=settings.data_source,
        llm=settings.llm_provider,
        docs="mock" if docs_mock else "real",
        is_mock=settings.calc_engine == "mock" or settings.data_source == "mock",
    )
