"""계산기 인터페이스 (PRD §4.2). 실제 공식은 이 클래스를 상속한 RealCalculator에서 구현한다."""

import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime

from app.domain.models.calc import (
    CalcInput,
    CalcMeta,
    CalcResult,
    CleaningMethodComparison,
    CurrentState,
    LossEstimate,
    PinchApproachEvaluation,
    RecoveryEstimate,
    SectionHealth,
    SensitivitySeries,
)


class CalculatorService(ABC):
    engine: str
    version: str

    # ---- 오케스트레이션 (공통, 보통 오버라이드 불필요) ----
    def evaluate(self, inp: CalcInput) -> CalcResult:
        self.validate(inp)
        current = self.assess_current_state(inp)
        loss = self.estimate_loss(inp, current)
        recovery = self.estimate_recovery(inp, loss)
        return CalcResult(
            meta=self._meta(inp),
            input=inp,
            current=current,
            loss=loss,
            recovery=recovery,
            cleaning_comparison=self.compare_cleaning_methods(inp, loss, recovery),
            pinch_approach=self.evaluate_pinch_approach(inp),
            sections=self.section_health(inp),
            sensitivity=self.sensitivity(inp),
        )

    @property
    def is_mock(self) -> bool:
        return self.engine == "mock"

    def collect_warnings(self, inp: CalcInput) -> list[str]:
        """입력 범위 외삽 등 결과 신뢰도 경고(i18n 키). 기본은 없음."""
        return []

    def _meta(self, inp: CalcInput) -> CalcMeta:
        return CalcMeta(
            calc_id=str(uuid.uuid4()),
            engine=self.engine,
            engine_version=self.version,
            computed_at=datetime.now(UTC),
            is_mock=self.is_mock,
            warnings=self.collect_warnings(inp),
        )

    # ---- 구현체가 채워야 하는 단위 계산 (교체 포인트) ----
    @abstractmethod
    def validate(self, inp: CalcInput) -> None: ...

    @abstractmethod
    def assess_current_state(self, inp: CalcInput) -> CurrentState: ...

    @abstractmethod
    def estimate_loss(self, inp: CalcInput, current: CurrentState) -> LossEstimate: ...

    @abstractmethod
    def estimate_recovery(self, inp: CalcInput, loss: LossEstimate) -> RecoveryEstimate: ...

    @abstractmethod
    def compare_cleaning_methods(
        self, inp: CalcInput, loss: LossEstimate, recovery: RecoveryEstimate
    ) -> list[CleaningMethodComparison]: ...

    @abstractmethod
    def evaluate_pinch_approach(self, inp: CalcInput) -> list[PinchApproachEvaluation]: ...

    @abstractmethod
    def section_health(self, inp: CalcInput) -> list[SectionHealth]: ...

    @abstractmethod
    def sensitivity(self, inp: CalcInput) -> SensitivitySeries: ...
