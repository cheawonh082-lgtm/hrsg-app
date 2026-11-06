"""레퍼런스 데이터 인터페이스 (PRD §4.2). 공식과 별도로 데이터만 먼저 교체할 수 있도록 분리."""

from abc import ABC, abstractmethod

from app.calculator.kit_adapter import Preset
from app.domain.models.calc import CalcInput, GasTurbineSpec, Locale


class ReferenceDataProvider(ABC):
    @abstractmethod
    def list_gt_models(self) -> list[GasTurbineSpec]: ...

    @abstractmethod
    def get_gt_model(self, model_id: str) -> GasTurbineSpec:
        """없는 모델이면 UnknownGtModelError."""

    @abstractmethod
    def default_input(self, model_id: str, preset: Preset = "example", locale: Locale = "ko") -> CalcInput:
        """계산기 화면 입력값. example: 예시 운전 상태(처음 화면) / design: 설계 상태(「초기화」, 손실 0)."""
