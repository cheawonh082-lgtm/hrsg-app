from typing import Literal

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.domain.models.base import CamelModel

router = APIRouter(prefix="/api", tags=["health"])


class HealthStatus(CamelModel):
    engine: Literal["mock", "real"]
    data_source: Literal["mock", "real"]
    llm: str
    is_mock: bool  # 계산 엔진 또는 데이터 중 하나라도 Mock이면 true → UI MOCK 배너


@router.get("/health", response_model=HealthStatus)
def health(settings: Settings = Depends(get_settings)):
    return HealthStatus(
        engine=settings.calc_engine,
        data_source=settings.data_source,
        llm=settings.llm_provider,
        is_mock=settings.calc_engine == "mock" or settings.data_source == "mock",
    )
