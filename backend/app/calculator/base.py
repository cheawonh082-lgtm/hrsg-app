"""계산기 인터페이스. 기본 구현은 팀 공통 키트를 쓰는 KitCalculator(app.calculator.kit_calculator)다.
실제 공식은 이 클래스를 상속한 RealCalculator에서 구현한다."""

import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime

from app.domain.models.calc import CalcInput, CalcMeta, CalcResult


class CalculatorService(ABC):
    engine: str
    version: str

    @abstractmethod
    def evaluate(self, inp: CalcInput) -> CalcResult: ...

    @property
    def is_mock(self) -> bool:
        return self.engine == "mock"

    def _meta(self, warnings: list[str] | None = None) -> CalcMeta:
        return CalcMeta(
            calc_id=str(uuid.uuid4()),
            engine=self.engine,
            engine_version=self.version,
            computed_at=datetime.now(UTC),
            is_mock=self.is_mock,
            warnings=warnings or [],
        )
