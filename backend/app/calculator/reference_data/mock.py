from app import kit
from app.calculator.kit_adapter import Preset, gt_class, gt_spec, preset_input
from app.domain.models.calc import CalcInput, GasTurbineSpec, Locale

from .provider import ReferenceDataProvider


class KitReferenceData(ReferenceDataProvider):
    """팀 공통 키트 data/calculator.json (DEMO 값) 기반 레퍼런스 데이터."""

    def __init__(self, data: dict | None = None):
        self.D = data if data is not None else kit.calculator_data()

    def list_gt_models(self) -> list[GasTurbineSpec]:
        return [gt_spec(g) for g in self.D["gt_classes"]]

    def get_gt_model(self, model_id: str) -> GasTurbineSpec:
        return gt_spec(gt_class(model_id, self.D))

    def default_input(self, model_id: str, preset: Preset = "example", locale: Locale = "ko") -> CalcInput:
        return preset_input(model_id, preset, self.D, locale)
