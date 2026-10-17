"""엔진 선택 팩토리 (DI). CALC_ENGINE / DATA_SOURCE 환경변수로 구현체를 고른다."""

from functools import lru_cache

from fastapi import Depends

from app.calculator.base import CalculatorService
from app.calculator.mock import MockCalculator
from app.calculator.real import RealCalculator
from app.calculator.reference_data.mock import MockReferenceData
from app.calculator.reference_data.provider import ReferenceDataProvider
from app.calculator.reference_data.real import RealReferenceData
from app.calculator.result_cache import CalcResultCache
from app.config import Settings, get_settings


@lru_cache
def _mock_reference_data() -> MockReferenceData:
    return MockReferenceData()


@lru_cache
def get_result_cache() -> CalcResultCache:
    return CalcResultCache()


def get_reference_data(settings: Settings = Depends(get_settings)) -> ReferenceDataProvider:
    if settings.data_source == "real":
        return RealReferenceData(settings.secrets_dir)
    return _mock_reference_data()


def get_calculator(
    settings: Settings = Depends(get_settings),
    data: ReferenceDataProvider = Depends(get_reference_data),
) -> CalculatorService:
    if settings.calc_engine == "real":
        return RealCalculator(data)
    return MockCalculator(data)
