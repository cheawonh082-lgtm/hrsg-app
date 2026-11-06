"""계산기 입력/결과 스키마. 프론트 TS 타입은 이 모델의 OpenAPI에서 생성된다.

계산은 팀 공통 키트(hrsg_calc_kit_team2/calc.py)가 한다. 입력(CalcInput)은 이 앱 화면의 필드이고,
app.calculator.kit_adapter가 키트 입력(inp)으로 바꾼다. 결과는 키트 결과(r = calculate(inp, D) 등)를 옮긴 것이다.
"""

from datetime import datetime
from typing import Literal

from pydantic import Field

from .base import CamelModel

Locale = Literal["ko", "en"]
StatusLevel = Literal["normal", "caution", "danger"]
# 키트의 'no_data'(평가에 필요한 값 없음)
LevelOrNoData = Literal["normal", "caution", "danger", "no_data"]


# ---- 공통 ----
class CalcMeta(CamelModel):
    calc_id: str
    engine: Literal["mock", "real"]
    engine_version: str  # 키트 data/calculator.json 의 engine (예: common-0.2)
    computed_at: datetime
    is_mock: bool
    # 키트 calculate()의 warnings(가정 확인 문구) + input_warnings(이름·단위 의심) — 키트 문구 그대로
    warnings: list[str] = Field(default_factory=list)


class Metric(CamelModel):
    key: str
    value: float
    unit: str
    status: StatusLevel | None = None
    baseline: float | None = None  # 설계값
    delta: float | None = None
    # 키트 indicators 의 판정 기준 (절대값) — 게이지·그래프 구간
    caution: float | None = None
    danger: float | None = None
    min: float | None = None
    max: float | None = None


# ---- 입력 ----
class GasTurbineSpec(CamelModel):
    """키트 data/calculator.json 의 gt_classes 한 개 (model_id 는 GT_MOCK_<등급>_CLASS)"""

    model_id: str
    display_name: str
    rated_power_mw: float  # GT 정격
    rated_st_mw: float
    rated_exhaust_flow_kg_s: float
    rated_exhaust_temp_c: float


class OperatingCondition(CamelModel):
    gt_load_pct: float = Field(..., ge=30, le=100)
    ambient_temp_c: float = Field(..., ge=-20, le=45)
    exhaust_temp_c: float = Field(..., ge=450, le=680)
    exhaust_flow_kg_s: float = Field(..., gt=0)
    gt_back_pressure_mbar: float = Field(..., ge=0, le=100)
    hrsg_gas_dp_mbar: float = Field(..., ge=0, le=100)
    stack_temp_c: float = Field(..., ge=60, le=250)
    # 고급 입력 — HP 섹션 핀치·어프로치, HP 스팀 생산량 (비우면 「데이터 필요」)
    hp_steam_tph: float | None = Field(None, ge=0, le=1500)
    hp_drum_pressure_barg: float | None = Field(None, ge=0, le=200)
    hp_evap_gas_out_temp_c: float | None = Field(None, ge=0, le=700)
    hp_eco_water_out_temp_c: float | None = Field(None, ge=0, le=400)


class EconomicParams(CamelModel):
    electricity_price_krw_per_mwh: float = Field(..., gt=0)
    # 키트 economics.monthly_hours(월간 금액·회수기간) · annual_hours(연간 금액) — 따로 받는다
    monthly_operating_hours: int = Field(720, ge=1, le=744)
    annual_operating_hours: int = Field(8000, ge=1, le=8760)


class CalcInput(CamelModel):
    gt_model_id: str
    condition: OperatingCondition
    economics: EconomicParams
    locale: Locale = "ko"


# ---- 결과 ----
class CurrentState(CamelModel):
    overall_status: StatusLevel  # 키트 r.overall_level (지표 3개 중 가장 나쁜 것)
    fouling_index: float = Field(..., ge=0, le=100)  # 키트 r.index.value — 화면은 반올림해 정수로
    pressure_part: float
    temp_part: float
    metrics: list[Metric]  # gtBackPressure · hrsgGasDp · stackTemp (키트 r.indicators)


class LossEstimate(CamelModel):
    gt_power_loss_mw: float
    st_power_loss_mw: float
    total_power_loss_mw: float
    excess_pressure_mbar: float
    excess_stack_c: float
    monthly_loss_krw: float
    annual_revenue_loss_krw: float  # 키트 r.annual_loss_krw


class RecoveryEstimate(CamelModel):
    """기본 공법(키트 constants.default_method)으로 세정했을 때 — 키트 r.default_method"""

    method_id: str | None
    name: str | None  # 키트 methods[].name (키트 문구 그대로)
    recovered_power_mw: float
    loss_after_mw: float
    monthly_recovery_krw: float
    annual_recovery_krw: float
    recovery_rate_pct: float  # 손실 대비 회수율 (recovery_vs_loss × 100)
    expected_bp_after_mbar: float
    expected_dp_after_mbar: float
    expected_stack_temp_after_c: float


class TrendPoint(CamelModel):
    x: float
    y: float


class EfficiencyEstimate(CamelModel):
    """열회수 효율(%) — 키트 r.efficiency · efficiency_trend() · key_indicators().kpi.heat_recovery_eff.
    배기·외기 온도가 없으면 None."""

    current_pct: float | None
    after_cleaning_pct: float | None
    design_pct: float | None
    vs_design_pp: float | None
    # 키트 constants.efficiency_drop_pp 기준선 (설계 − 주의/위험 저하폭)
    caution_pct: float | None
    danger_pct: float | None
    status: LevelOrNoData
    trend: list[TrendPoint]  # x: 개월(0~12), y: 효율(%) — 12개월 선형 저하 가정


class CleaningMethodComparison(CamelModel):
    """키트 compare_methods().rows 한 줄. available=false 면 「산출 불가 — 입력 필요: …」"""

    method_id: str
    name: str  # 키트 methods[].name (키트 문구 그대로)
    available: bool
    missing: list[str] = Field(default_factory=list)
    cost_krw: float | None = None
    downtime_days: float | None = None  # 키트 outage_days
    indirect_krw: float | None = None
    expected_recovery_pct: float | None = None  # 키트 recovery_ratio × 100
    recovered_power_mw: float | None = None
    recovery_basis: Literal["mw", "ratio", "target"] | None = None
    outage_loss_krw: float | None = None
    total_investment_krw: float | None = None
    monthly_benefit_krw: float | None = None
    annual_benefit_krw: float | None = None
    payback_months: float | None = None  # None → 「산출 불가」
    breakeven_days: float | None = None
    first_month_net_krw: float | None = None
    net_benefit_krw: float | None = None  # 키트 annual_net_krw (연간 순편익)
    max_net_benefit: bool = False  # 「순편익 최대」 — 「권장」·「추천」이라고 쓰지 않는다
    best_payback: bool = False  # 회수기간이 가장 짧은 공법 (가정 기준, 추천 아님)


class PinchApproachEvaluation(CamelModel):
    """키트 pinch_section() — HP/IP/LP"""

    section: Literal["HP", "IP", "LP"]
    pinch_c: float | None
    approach_c: float | None
    design_pinch_c: float
    design_approach_c: float
    saturation_temp_c: float | None = None
    status: StatusLevel | Literal["insufficient_data"]
    message: str  # 키트 문구 그대로
    checklist_category: str  # 「데이터 필요」 → 체크리스트 분류 (키트: 'B')


class KeyIndicators(CamelModel):
    """탭 3 핵심 성능 지표 — 키트 key_indicators().kpi 중 다른 결과에 없는 값"""

    overall_status: StatusLevel  # 섹션·효율·지표를 모두 본 종합 상태
    hp_steam_tph: float | None
    cleaning_method_id: str | None
    cleaning_method_name: str | None
    cleaning_cost_krw: float | None  # 기본 공법 총투자
    payback_months: float | None  # 기본 공법 회수기간 (None → 「산출 불가」)


class DisplayFouling(CamelModel):
    """HRSG 도식 표시용 오염도 0~1 — 키트 r.display_fouling (손실 계산과 무관)"""

    overall: float
    superheater: float
    evaporator: float
    economizer: float


class SensitivitySeries(CamelModel):
    """차압 변화에 따른 손실 감도 — 키트 loss_curve(param='hrsg_dp')"""

    x_key: Literal["hrsgGasDpMbar"] = "hrsgGasDpMbar"
    y_key: Literal["totalPowerLossMw"] = "totalPowerLossMw"
    points: list[TrendPoint]
    current_x: float
    design_x: float
    caution_x: float
    danger_x: float


class CalcResult(CamelModel):
    meta: CalcMeta
    input: CalcInput
    current: CurrentState
    loss: LossEstimate
    recovery: RecoveryEstimate
    efficiency: EfficiencyEstimate
    cleaning_comparison: list[CleaningMethodComparison]
    pinch_approach: list[PinchApproachEvaluation]
    key_indicators: KeyIndicators
    display_fouling: DisplayFouling
    sensitivity: SensitivitySeries
