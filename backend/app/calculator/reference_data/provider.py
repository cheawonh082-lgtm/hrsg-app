"""레퍼런스 데이터 인터페이스 (PRD §4.2). 공식과 별도로 데이터만 먼저 교체할 수 있도록 분리."""

from abc import ABC, abstractmethod

from app.domain.models.calc import EconomicParams, GasTurbineSpec, OperatingCondition
from app.domain.models.reference import CleaningMethodSpec, DesignBaseline, StatusThresholds


class ReferenceDataProvider(ABC):
    @abstractmethod
    def list_gt_models(self) -> list[GasTurbineSpec]: ...

    @abstractmethod
    def get_gt_model(self, model_id: str) -> GasTurbineSpec:
        """없는 모델이면 UnknownGtModelError."""

    @abstractmethod
    def get_design_baseline(self, model_id: str) -> DesignBaseline: ...

    @abstractmethod
    def get_default_condition(self, model_id: str) -> OperatingCondition:
        """계산기 화면 초기값(설계 운전점)."""

    @abstractmethod
    def get_default_economics(self) -> EconomicParams: ...

    @abstractmethod
    def list_cleaning_methods(self) -> list[CleaningMethodSpec]: ...

    @abstractmethod
    def get_thresholds(self) -> StatusThresholds: ...
