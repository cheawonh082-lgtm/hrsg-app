import json
from pathlib import Path

from app.calculator.errors import UnknownGtModelError
from app.domain.models.calc import EconomicParams, GasTurbineSpec, OperatingCondition
from app.domain.models.reference import CleaningMethodSpec, DesignBaseline, StatusThresholds

from .provider import ReferenceDataProvider

_DATA_FILE = Path(__file__).with_name("mock_gt_models.json")


class MockReferenceData(ReferenceDataProvider):
    """mock_gt_models.json 기반 가상 레퍼런스 데이터."""

    def __init__(self, path: Path = _DATA_FILE):
        raw = json.loads(path.read_text(encoding="utf-8"))
        self._models = {m["model_id"]: GasTurbineSpec.model_validate(m) for m in raw["gt_models"]}
        self._baselines = {k: DesignBaseline.model_validate(v) for k, v in raw["design_baseline"].items()}
        self._conditions = {
            k: OperatingCondition.model_validate(v) for k, v in raw["default_conditions"].items()
        }
        self._economics = EconomicParams.model_validate(raw["default_economics"])
        self._cleaning = [CleaningMethodSpec.model_validate(m) for m in raw["cleaning_methods"]]
        self._thresholds = StatusThresholds.model_validate(raw["thresholds"])

    def list_gt_models(self) -> list[GasTurbineSpec]:
        return list(self._models.values())

    def get_gt_model(self, model_id: str) -> GasTurbineSpec:
        try:
            return self._models[model_id]
        except KeyError:
            raise UnknownGtModelError(model_id) from None

    def get_design_baseline(self, model_id: str) -> DesignBaseline:
        self.get_gt_model(model_id)
        return self._baselines[model_id]

    def get_default_condition(self, model_id: str) -> OperatingCondition:
        self.get_gt_model(model_id)
        return self._conditions[model_id]

    def get_default_economics(self) -> EconomicParams:
        return self._economics

    def list_cleaning_methods(self) -> list[CleaningMethodSpec]:
        return list(self._cleaning)

    def get_thresholds(self) -> StatusThresholds:
        return self._thresholds
