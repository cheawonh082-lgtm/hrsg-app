"""MockCalculator — 결정적(deterministic) 가상 계산 (PRD §4.3).

방향성(ΔP↑ → 손실↑, 스택온도↑ → ST 손실↑, 세정 → 회수)만 현실적으로 흉내 낸다.
계수는 모두 임의값이며 실제 공식과 무관하다. 실제 공식은 RealCalculator에서 구현한다.
"""

from app.calculator.base import CalculatorService
from app.calculator.errors import UnknownCleaningMethodError
from app.calculator.reference_data.provider import ReferenceDataProvider
from app.calculator.steam import saturation_temp_c
from app.domain.models.calc import (
    CalcInput,
    CleaningMethodComparison,
    CurrentState,
    LossEstimate,
    Metric,
    OperatingCondition,
    PinchApproachEvaluation,
    RecoveryEstimate,
    SectionHealth,
    SectionId,
    SensitivitySeries,
    StatusLevel,
    TrendPoint,
)
from app.domain.status import classify, deviation, worst

# MOCK: 실제 공식 입수 시 RealCalculator로 대체 — 이 값들에 물리적 의미를 부여하지 말 것
MOCK_K = {
    "gt_loss_pct_per_mbar": 0.08,   # ΔP 초과 1 mbar당 GT 출력 손실(%)
    "st_loss_mw_per_degc": 0.05,    # 스택온도 상승 1℃당 ST 출력 손실(MW)
    "cc_output_factor": 1.5,        # 복합 출력 ≈ GT 정격 × 계수
    "dp_recovery_ratio": 0.7,       # 세정 시 초과분 회수 비율
    "fouling_dp_weight": 1.5,
    "fouling_stack_weight": 1.0,
    "sensitivity_points": 21,
}

# MOCK: 섹션 출구까지의 누적 가스온도 강하 비율 (GT 출구 → 스택)
_SECTION_PROFILE: list[tuple[SectionId, float]] = [
    ("HP_SH", 0.12), ("RH", 0.20), ("HP_EVA", 0.50), ("HP_ECO", 0.62),
    ("IP_SH", 0.64), ("IP_EVA", 0.72), ("IP_ECO", 0.76),
    ("LP_SH", 0.78), ("LP_EVA", 0.90), ("CPH", 1.00),
]
# MOCK: 고온부는 차압, 저온부는 스택온도 상태를 따른다
_COLD_END: set[SectionId] = {"LP_SH", "LP_EVA", "CPH", "STACK"}


class MockCalculator(CalculatorService):
    engine = "mock"
    version = "mock-0.1.0"

    def __init__(self, data: ReferenceDataProvider):
        self.data = data

    # ---- 검증 ----
    def validate(self, inp: CalcInput) -> None:
        self.data.get_gt_model(inp.gt_model_id)
        if inp.cleaning_method_ids:
            known = {m.method_id for m in self.data.list_cleaning_methods()}
            unknown = [m for m in inp.cleaning_method_ids if m not in known]
            if unknown:
                raise UnknownCleaningMethodError(unknown)

    def collect_warnings(self, inp: CalcInput) -> list[str]:
        gt = self.data.get_gt_model(inp.gt_model_id)
        c = inp.condition
        warnings = []
        if abs(c.exhaust_flow_kg_s - gt.rated_exhaust_flow_kg_s) > gt.rated_exhaust_flow_kg_s * 0.2:
            warnings.append("warn.exhaustFlowOffRated")
        if c.exhaust_temp_c > gt.rated_exhaust_temp_c + 30:
            warnings.append("warn.exhaustTempAboveRated")
        return warnings

    # ---- 현재 상태 ----
    def _dp_status(self, inp: CalcInput) -> StatusLevel:
        base = self.data.get_design_baseline(inp.gt_model_id)
        band = self.data.get_thresholds().hrsg_gas_dp
        return classify(deviation(inp.condition.hrsg_gas_dp_mbar, base.gas_dp_mbar, band), band)

    def _stack_status(self, inp: CalcInput) -> StatusLevel:
        base = self.data.get_design_baseline(inp.gt_model_id)
        band = self.data.get_thresholds().stack_temp
        return classify(deviation(inp.condition.stack_temp_c, base.stack_temp_c, band), band)

    def assess_current_state(self, inp: CalcInput) -> CurrentState:
        c = inp.condition
        base = self.data.get_design_baseline(inp.gt_model_id)
        th = self.data.get_thresholds()

        bp_status = classify(
            deviation(c.gt_back_pressure_mbar, base.back_pressure_mbar, th.gt_back_pressure),
            th.gt_back_pressure,
        )
        metrics = [
            _metric("gtBackPressure", c.gt_back_pressure_mbar, "mbar", base.back_pressure_mbar, bp_status),
            _metric("hrsgGasDp", c.hrsg_gas_dp_mbar, "mbar", base.gas_dp_mbar, self._dp_status(inp)),
            _metric("stackTemp", c.stack_temp_c, "℃", base.stack_temp_c, self._stack_status(inp)),
        ]
        if c.hp_steam_flow_kg_s is not None:
            metrics.append(Metric(key="hpSteamFlow", value=c.hp_steam_flow_kg_s, unit="kg/s"))

        dp_pct = max(0.0, deviation(c.hrsg_gas_dp_mbar, base.gas_dp_mbar, th.hrsg_gas_dp))
        stack_rise = max(0.0, c.stack_temp_c - base.stack_temp_c)
        fouling = dp_pct * MOCK_K["fouling_dp_weight"] + stack_rise * MOCK_K["fouling_stack_weight"]

        return CurrentState(
            overall_status=worst(m.status for m in metrics if m.status),
            fouling_index=round(min(100.0, fouling), 1),
            metrics=metrics,
        )

    # ---- 손실 / 회수 ----
    def estimate_loss(self, inp: CalcInput, current: CurrentState) -> LossEstimate:
        gt = self.data.get_gt_model(inp.gt_model_id)
        base = self.data.get_design_baseline(inp.gt_model_id)
        c = inp.condition
        e = inp.economics

        dp_excess = max(0.0, c.hrsg_gas_dp_mbar - base.gas_dp_mbar)
        stack_excess = max(0.0, c.stack_temp_c - base.stack_temp_c)
        load = c.gt_load_pct / 100

        gt_loss = gt.rated_power_mw * load * MOCK_K["gt_loss_pct_per_mbar"] * dp_excess / 100
        st_loss = MOCK_K["st_loss_mw_per_degc"] * stack_excess * load
        total = gt_loss + st_loss
        cc_output = gt.rated_power_mw * load * MOCK_K["cc_output_factor"]

        return LossEstimate(
            gt_power_loss_mw=round(gt_loss, 3),
            st_power_loss_mw=round(st_loss, 3),
            total_power_loss_mw=round(total, 3),
            heat_rate_increase_pct=round(total / cc_output * 100, 2),
            annual_revenue_loss_krw=round(total * e.annual_operating_hours * e.electricity_price_krw_per_mwh),
            annual_fuel_penalty_krw=None,  # MOCK: 산정 방식 확정 전 미제공
        )

    def estimate_recovery(self, inp: CalcInput, loss: LossEstimate) -> RecoveryEstimate:
        base = self.data.get_design_baseline(inp.gt_model_id)
        c = inp.condition
        ratio = MOCK_K["dp_recovery_ratio"]

        dp_excess = max(0.0, c.hrsg_gas_dp_mbar - base.gas_dp_mbar)
        stack_excess = max(0.0, c.stack_temp_c - base.stack_temp_c)
        has_loss = loss.total_power_loss_mw > 0

        return RecoveryEstimate(
            expected_dp_after_mbar=round(c.hrsg_gas_dp_mbar - dp_excess * ratio, 2),
            expected_stack_temp_after_c=round(c.stack_temp_c - stack_excess * ratio, 1),
            recovered_power_mw=round(loss.total_power_loss_mw * ratio, 3),
            annual_recovery_krw=round(loss.annual_revenue_loss_krw * ratio),
            recovery_rate_pct=round(ratio * 100, 1) if has_loss else 0.0,
        )

    def compare_cleaning_methods(
        self, inp: CalcInput, loss: LossEstimate, recovery: RecoveryEstimate
    ) -> list[CleaningMethodComparison]:
        methods = self.data.list_cleaning_methods()
        if inp.cleaning_method_ids:
            methods = [m for m in methods if m.method_id in inp.cleaning_method_ids]

        years = inp.economics.analysis_period_years
        rows = []
        for m in methods:
            # MOCK: 계획정비 기간 중 세정한다고 가정 → 정지일수는 비용에 미반영(정보 표시용)
            annual_benefit = loss.annual_revenue_loss_krw * m.recovery_pct / 100
            rows.append(
                CleaningMethodComparison(
                    method_id=m.method_id,
                    name_key=m.name_key,
                    cost_krw=m.cost_krw,
                    downtime_days=m.downtime_days,
                    expected_recovery_pct=m.recovery_pct,
                    payback_months=round(m.cost_krw / (annual_benefit / 12), 1) if annual_benefit > 0 else None,
                    net_benefit_krw=round(annual_benefit * years - m.cost_krw),
                    recommended=False,
                    notes_key=m.notes_key,
                )
            )

        best = max(rows, key=lambda r: r.net_benefit_krw, default=None)
        if best and best.net_benefit_krw > 0:
            best.recommended = True
        return rows

    # ---- 핀치 / 어프로치 ----
    def evaluate_pinch_approach(self, inp: CalcInput) -> list[PinchApproachEvaluation]:
        base = self.data.get_design_baseline(inp.gt_model_id)
        band = self.data.get_thresholds().pinch
        c = inp.condition

        pinch = approach = None
        if c.hp_drum_pressure_barg is not None:
            tsat = saturation_temp_c(c.hp_drum_pressure_barg)
            if c.hp_evap_gas_out_temp_c is not None:
                pinch = round(c.hp_evap_gas_out_temp_c - tsat, 1)
            if c.hp_eco_water_out_temp_c is not None:
                approach = round(tsat - c.hp_eco_water_out_temp_c, 1)

        hp_status = "insufficient_data" if pinch is None else classify(pinch - base.hp_pinch_c, band)
        result = [
            PinchApproachEvaluation(
                section="HP",
                pinch_c=pinch,
                approach_c=approach,
                design_pinch_c=base.hp_pinch_c,
                design_approach_c=base.hp_approach_c,
                status=hp_status,
                comment_key=f"pinch.comment.{hp_status}",
            )
        ]
        # IP/LP는 현재 입력 항목이 없어 항상 데이터 필요 상태 (체크리스트로 유도)
        for section, design_pinch, design_approach in (
            ("IP", base.ip_pinch_c, base.ip_approach_c),
            ("LP", base.lp_pinch_c, base.lp_approach_c),
        ):
            result.append(
                PinchApproachEvaluation(
                    section=section,
                    pinch_c=None,
                    approach_c=None,
                    design_pinch_c=design_pinch,
                    design_approach_c=design_approach,
                    status="insufficient_data",
                    comment_key="pinch.comment.insufficient_data",
                )
            )
        return result

    # ---- 도식 / 민감도 ----
    def section_health(self, inp: CalcInput) -> list[SectionHealth]:
        c = inp.condition
        dp_status = self._dp_status(inp)
        stack_status = self._stack_status(inp)
        total_drop = c.exhaust_temp_c - c.stack_temp_c

        sections = []
        gas_in = c.exhaust_temp_c
        for section_id, cumulative in _SECTION_PROFILE:
            gas_out = round(c.exhaust_temp_c - total_drop * cumulative, 1)
            sections.append(
                SectionHealth(
                    section_id=section_id,
                    status=stack_status if section_id in _COLD_END else dp_status,
                    gas_in_temp_c=round(gas_in, 1),
                    gas_out_temp_c=gas_out,
                )
            )
            gas_in = gas_out
        sections.append(
            SectionHealth(
                section_id="STACK",
                status=stack_status,
                gas_in_temp_c=c.stack_temp_c,
                gas_out_temp_c=c.stack_temp_c,
            )
        )
        return sections

    def sensitivity(self, inp: CalcInput) -> SensitivitySeries:
        base = self.data.get_design_baseline(inp.gt_model_id)
        c = inp.condition
        lo = base.gas_dp_mbar * 0.8
        hi = min(100.0, max(base.gas_dp_mbar * 2, c.hrsg_gas_dp_mbar * 1.2))
        n = MOCK_K["sensitivity_points"]

        points = []
        for i in range(n):
            x = round(lo + (hi - lo) * i / (n - 1), 2)
            what_if = inp.model_copy(update={"condition": _with_dp(c, x)})
            loss = self.estimate_loss(what_if, current=None)  # type: ignore[arg-type]  # Mock은 current 미사용
            points.append(TrendPoint(x=x, y=loss.total_power_loss_mw))
        return SensitivitySeries(points=points, current_x=c.hrsg_gas_dp_mbar)


def _metric(key: str, value: float, unit: str, baseline: float, status: StatusLevel) -> Metric:
    return Metric(
        key=key, value=value, unit=unit, status=status, baseline=baseline, delta=round(value - baseline, 2)
    )


def _with_dp(c: OperatingCondition, dp: float) -> OperatingCondition:
    return c.model_copy(update={"hrsg_gas_dp_mbar": dp})
