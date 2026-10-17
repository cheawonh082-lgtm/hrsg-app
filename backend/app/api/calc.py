from fastapi import APIRouter, Depends, Query

from app.calculator.base import CalculatorService
from app.calculator.reference_data.provider import ReferenceDataProvider
from app.calculator.registry import get_calculator, get_reference_data
from app.domain.models.calc import CalcInput, CalcResult, GasTurbineSpec, Locale
from app.domain.models.limits import InputLimits, input_limits
from app.domain.models.reference import StatusThresholds

router = APIRouter(prefix="/api/calc", tags=["calc"])


@router.get("/gt-models", response_model=list[GasTurbineSpec])
def list_gt_models(data: ReferenceDataProvider = Depends(get_reference_data)):
    return data.list_gt_models()


@router.get("/defaults", response_model=CalcInput)
def get_defaults(
    gt_model_id: str = Query(alias="gtModelId"),
    locale: Locale = "ko",
    data: ReferenceDataProvider = Depends(get_reference_data),
):
    return CalcInput(
        gt_model_id=data.get_gt_model(gt_model_id).model_id,
        condition=data.get_default_condition(gt_model_id),
        economics=data.get_default_economics(),
        locale=locale,
    )


@router.get("/thresholds", response_model=StatusThresholds)
def get_thresholds(data: ReferenceDataProvider = Depends(get_reference_data)):
    return data.get_thresholds()


@router.get("/input-limits", response_model=InputLimits)
def get_input_limits():
    return input_limits()


@router.post("/evaluate", response_model=CalcResult)
def evaluate(inp: CalcInput, calculator: CalculatorService = Depends(get_calculator)):
    return calculator.evaluate(inp)
