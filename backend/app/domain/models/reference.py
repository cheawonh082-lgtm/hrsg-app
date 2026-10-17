"""레퍼런스 데이터(설계 기준값·세정 공법·상태 임계값) 스키마. 실데이터 입수 시 값만 교체."""

from typing import Literal

from .base import CamelModel


class DesignBaseline(CamelModel):
    gas_dp_mbar: float
    stack_temp_c: float
    back_pressure_mbar: float
    hp_pinch_c: float
    hp_approach_c: float
    ip_pinch_c: float
    ip_approach_c: float
    lp_pinch_c: float
    lp_approach_c: float


class CleaningMethodSpec(CamelModel):
    method_id: str
    name_key: str
    cost_krw: float
    downtime_days: float
    recovery_pct: float
    notes_key: str | None = None


class ThresholdBand(CamelModel):
    """value < caution → 정상, caution ≤ value ≤ danger → 주의, value > danger → 위험."""

    basis: Literal["pct_increase", "delta"]  # 설계 대비 증가율(%) 또는 증가량
    unit: str
    caution: float
    danger: float


class StatusThresholds(CamelModel):
    hrsg_gas_dp: ThresholdBand
    stack_temp: ThresholdBand
    gt_back_pressure: ThresholdBand
    pinch: ThresholdBand
