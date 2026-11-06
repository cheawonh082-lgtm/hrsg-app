from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.calculator.base import CalculatorService
from app.calculator.errors import CalcResultNotFoundError
from app.calculator.reference_data.provider import ReferenceDataProvider
from app.calculator.registry import get_calculator, get_reference_data, get_result_cache
from app.calculator.result_cache import CalcResultCache
from app.domain.models.calc import CalcInput, CalcResult, GasTurbineSpec, Locale
from app.domain.models.limits import InputLimits, input_limits

router = APIRouter(prefix="/api/calc", tags=["calc"])


@router.get("/gt-models", response_model=list[GasTurbineSpec])
def list_gt_models(data: ReferenceDataProvider = Depends(get_reference_data)):
    return data.list_gt_models()


@router.get("/defaults", response_model=CalcInput)
def get_defaults(
    gt_model_id: str = Query(alias="gtModelId"),
    preset: Literal["example", "design"] = "example",
    locale: Locale = "ko",
    data: ReferenceDataProvider = Depends(get_reference_data),
):
    """example: 키트 defaultInputs (처음 화면, 예시 운전 상태) / design: 키트 designInputs (「초기화」, 손실 0)"""
    return data.default_input(gt_model_id, preset, locale)


@router.get("/input-limits", response_model=InputLimits)
def get_input_limits():
    return input_limits()


@router.post("/evaluate", response_model=CalcResult)
def evaluate(
    inp: CalcInput,
    calculator: CalculatorService = Depends(get_calculator),
    cache: CalcResultCache = Depends(get_result_cache),
):
    result = calculator.evaluate(inp)
    cache.put(result)
    return result


@router.get("/results/{calc_id}", response_model=CalcResult)
def get_result(calc_id: str, cache: CalcResultCache = Depends(get_result_cache)):
    result = cache.get(calc_id)
    if result is None:
        raise CalcResultNotFoundError(calc_id)
    return result
