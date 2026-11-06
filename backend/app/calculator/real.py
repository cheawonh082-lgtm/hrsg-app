"""RealCalculator — 실제 계산 공식 자리 (PRD §4.4 Runbook).

공식 입수 후 secrets/ 의 모듈로 evaluate를 구현한다. 그 전까지 호출 시 API는 501을 반환한다.
"""

from app.calculator.base import CalculatorService

_TODO = "실제 계산 공식 미입수 — CALC_ENGINE=mock 으로 실행하세요."


class RealCalculator(CalculatorService):
    engine = "real"
    version = "real-0.0.0"

    def __init__(self, data=None):
        self.data = data

    def evaluate(self, inp):
        raise NotImplementedError(_TODO)
