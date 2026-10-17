"""상태 판정(정상/주의/위험) 정책. 임계값 자체는 ReferenceDataProvider가 제공한다."""

from collections.abc import Iterable

from app.domain.models.calc import StatusLevel
from app.domain.models.reference import ThresholdBand

_SEVERITY: dict[StatusLevel, int] = {"normal": 0, "caution": 1, "danger": 2}


def classify(value: float, band: ThresholdBand) -> StatusLevel:
    if value > band.danger:
        return "danger"
    if value >= band.caution:
        return "caution"
    return "normal"


def deviation(value: float, baseline: float, band: ThresholdBand) -> float:
    """임계값 기준(basis)에 맞춰 설계 대비 편차를 계산."""
    delta = value - baseline
    if band.basis == "pct_increase":
        return delta / baseline * 100 if baseline else 0.0
    return delta


def worst(levels: Iterable[StatusLevel]) -> StatusLevel:
    return max(levels, key=_SEVERITY.__getitem__, default="normal")
