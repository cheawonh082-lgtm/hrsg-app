"""RealCalculator — 실제 계산 공식 자리 (PRD §4.4 Runbook).

공식 입수 후 secrets/ 의 모듈을 사용해 각 메서드를 구현한다. 그 전까지 호출 시 API는 501을 반환한다.
메서드 단위로 순차 구현하며, 미구현 메서드는 MockCalculator에 위임하고 meta.warnings에 'partial_mock'을 남긴다.
"""

from app.calculator.base import CalculatorService
from app.calculator.reference_data.provider import ReferenceDataProvider

_TODO = "실제 계산 공식 미입수 — CALC_ENGINE=mock 으로 실행하세요."


class RealCalculator(CalculatorService):
    engine = "real"
    version = "real-0.0.0"

    def __init__(self, data: ReferenceDataProvider):
        self.data = data

    def validate(self, inp):
        raise NotImplementedError(_TODO)

    def assess_current_state(self, inp):
        raise NotImplementedError(_TODO)

    def estimate_loss(self, inp, current):
        raise NotImplementedError(_TODO)

    def estimate_recovery(self, inp, loss):
        raise NotImplementedError(_TODO)

    def compare_cleaning_methods(self, inp, loss, recovery):
        raise NotImplementedError(_TODO)

    def evaluate_pinch_approach(self, inp):
        raise NotImplementedError(_TODO)

    def section_health(self, inp):
        raise NotImplementedError(_TODO)

    def sensitivity(self, inp):
        raise NotImplementedError(_TODO)
