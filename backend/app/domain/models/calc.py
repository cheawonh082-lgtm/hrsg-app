"""계산기 입력/결과 스키마 (PRD §2.1~2.3). 프론트 TS 타입은 이 모델의 OpenAPI에서 생성된다."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from .base import CamelModel

Locale = Literal["ko", "en"]
StatusLevel = Literal["normal", "caution", "danger"]
SectionId = Literal[
    "HP_SH", "RH", "HP_EVA", "HP_ECO", "IP_SH", "IP_EVA", "IP_ECO",
    "LP_SH", "LP_EVA", "CPH", "STACK",
]


# ---- 공통 ----
class CalcMeta(CamelModel):
    calc_id: str
    engine: Literal["mock", "real"]
    engine_version: str
    computed_at: datetime
    is_mock: bool
    warnings: list[str] = Field(default_factory=list)


class Metric(CamelModel):
    key: str
    value: float
    unit: str
    status: StatusLevel | None = None
    baseline: float | None = None
    delta: float | None = None


# ---- 입력 ----
class GasTurbineSpec(CamelModel):
    model_id: str
    display_name: str
    rated_power_mw: float
    rated_exhaust_flow_kg_s: float
    rated_exhaust_temp_c: float
    back_pressure_sensitivity: float | None = None


class OperatingCondition(CamelModel):
    gt_load_pct: float = Field(..., ge=30, le=100)
    ambient_temp_c: float = Field(..., ge=-20, le=45)
    exhaust_temp_c: float = Field(..., ge=450, le=680)
    exhaust_flow_kg_s: float = Field(..., gt=0)
    gt_back_pressure_mbar: float = Field(..., ge=0, le=100)
    hrsg_gas_dp_mbar: float = Field(..., ge=0, le=100)
    stack_temp_c: float = Field(..., ge=60, le=250)
    hp_steam_flow_kg_s: float | None = Field(None, ge=0)
    ip_steam_flow_kg_s: float | None = Field(None, ge=0)
    lp_steam_flow_kg_s: float | None = Field(None, ge=0)
    hp_drum_pressure_barg: float | None = Field(None, ge=0, le=200)
    hp_evap_gas_out_temp_c: float | None = Field(None, ge=0, le=700)
    hp_eco_water_out_temp_c: float | None = Field(None, ge=0, le=400)


class EconomicParams(CamelModel):
    electricity_price_krw_per_mwh: float = Field(..., gt=0)
    fuel_price_krw_per_gj: float | None = Field(None, gt=0)
    annual_operating_hours: int = Field(7000, ge=0, le=8760)
    analysis_period_years: int = Field(1, ge=1, le=20)


class CalcInput(CamelModel):
    gt_model_id: str
    condition: OperatingCondition
    economics: EconomicParams
    cleaning_method_ids: list[str] | None = None
    locale: Locale = "ko"


# ---- 결과 ----
class CurrentState(CamelModel):
    overall_status: StatusLevel
    fouling_index: float = Field(..., ge=0, le=100)
    metrics: list[Metric]


class LossEstimate(CamelModel):
    gt_power_loss_mw: float
    st_power_loss_mw: float
    total_power_loss_mw: float
    heat_rate_increase_pct: float
    annual_revenue_loss_krw: float
    annual_fuel_penalty_krw: float | None = None


class RecoveryEstimate(CamelModel):
    expected_dp_after_mbar: float
    expected_stack_temp_after_c: float
    recovered_power_mw: float
    annual_recovery_krw: float
    recovery_rate_pct: float


class CleaningMethodComparison(CamelModel):
    method_id: str
    name_key: str
    cost_krw: float
    downtime_days: float
    expected_recovery_pct: float
    payback_months: float | None  # 회수 편익이 0이면 산정 불가(null)
    net_benefit_krw: float
    recommended: bool
    notes_key: str | None = None


class PinchApproachEvaluation(CamelModel):
    section: Literal["HP", "IP", "LP"]
    pinch_c: float | None
    approach_c: float | None
    design_pinch_c: float
    design_approach_c: float
    status: StatusLevel | Literal["insufficient_data"]
    comment_key: str


class SectionHealth(CamelModel):
    section_id: SectionId
    status: StatusLevel
    gas_in_temp_c: float | None = None
    gas_out_temp_c: float | None = None


class TrendPoint(CamelModel):
    x: float
    y: float


class SensitivitySeries(CamelModel):
    x_key: Literal["hrsgGasDpMbar"] = "hrsgGasDpMbar"
    y_key: Literal["totalPowerLossMw"] = "totalPowerLossMw"
    points: list[TrendPoint]
    current_x: float


class CalcResult(CamelModel):
    meta: CalcMeta
    input: CalcInput
    current: CurrentState
    loss: LossEstimate
    recovery: RecoveryEstimate
    cleaning_comparison: list[CleaningMethodComparison]
    pinch_approach: list[PinchApproachEvaluation]
    sections: list[SectionHealth]
    sensitivity: SensitivitySeries
