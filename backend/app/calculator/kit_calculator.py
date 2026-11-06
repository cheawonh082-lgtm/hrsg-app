"""KitCalculator — 팀 공통 키트(hrsg_calc_kit_team2/calc.py)로 계산한다.

모든 값은 키트 data/calculator.json 의 DEMO 값이다(engine = mock). 식·상수는 키트에 있고 여기에는 없다.
여기서는 화면 입력 → 키트 입력(kit_adapter) → 키트 함수 → 화면 결과(CalcResult)로 옮기기만 한다.
  calculate()          탭 1 지표·손실·기본 공법 회수·효율·오염 지수·도식, 탭 2 공법 비교
  efficiency_trend()   열회수 효율 추이 (13개 점 + 세정 후)
  loss_curve()         차압 변화에 따른 손실 감도
  key_indicators()     탭 3 핀치·어프로치 섹션 + KPI
"""

from app import kit
from app.calculator.base import CalculatorService
from app.calculator.errors import KitInputError
from app.calculator.kit_adapter import to_kit_input
from app.domain.models.calc import (
    CalcInput,
    CalcResult,
    CleaningMethodComparison,
    CurrentState,
    DisplayFouling,
    EfficiencyEstimate,
    KeyIndicators,
    LossEstimate,
    Metric,
    PinchApproachEvaluation,
    RecoveryEstimate,
    SensitivitySeries,
    TrendPoint,
)

# 키트 indicators 키 → (화면 지표 키, 단위)
_INDICATORS = {
    "gt_bp_mbar": ("gtBackPressure", "mbar"),
    "hrsg_dp_mbar": ("hrsgGasDp", "mbar"),
    "stack_c": ("stackTemp", "℃"),
}


class KitCalculator(CalculatorService):
    engine = "mock"

    def __init__(self, data: dict | None = None):
        self.D = data if data is not None else kit.calculator_data()
        self.version = self.D["engine"]

    def evaluate(self, inp: CalcInput) -> CalcResult:
        calc, D = kit.calc(), self.D
        k = to_kit_input(inp, D)
        check = calc.validate_inputs(k, D)
        if not check["ok"]:
            raise KitInputError(check["errors"])
        try:
            r = calc.calculate(k, D)
            ki = calc.key_indicators(k, D)
            trend = calc.efficiency_trend(k, D)
            curve = calc.loss_curve(k, D, param="hrsg_dp")
        except (TypeError, ValueError) as e:  # 키트가 계산할 수 없다고 낸 오류 (예: 증발기 출구 가스 < 포화온도)
            raise KitInputError([str(e)]) from e

        return CalcResult(
            meta=self._meta(r["warnings"] + r["input_warnings"]),
            input=inp,
            current=_current(r),
            loss=_loss(r),
            recovery=_recovery(r),
            efficiency=_efficiency(r, ki, trend, D),
            cleaning_comparison=_methods(r),
            pinch_approach=[_pinch(s) for s in ki["sections"]],
            key_indicators=_key_indicators(ki, r),
            display_fouling=DisplayFouling(**r["display_fouling"]),
            sensitivity=_sensitivity(curve),
        )


def _current(r: dict) -> CurrentState:
    metrics = []
    for kit_key, (key, unit) in _INDICATORS.items():
        ind = r["indicators"][kit_key]
        metrics.append(
            Metric(
                key=key,
                value=ind["value"],
                unit=unit,
                status=ind["level"],
                baseline=ind["design"],
                delta=ind["value"] - ind["design"],
                caution=ind["caution"],
                danger=ind["danger"],
                min=ind["min"],
                max=ind["max"],
            )
        )
    return CurrentState(
        overall_status=r["overall_level"],
        fouling_index=min(100.0, max(0.0, r["index"]["value"])),
        pressure_part=r["index"]["pressure_part"],
        temp_part=r["index"]["temp_part"],
        metrics=metrics,
    )


def _loss(r: dict) -> LossEstimate:
    return LossEstimate(
        gt_power_loss_mw=r["loss"]["gt_mw"],
        st_power_loss_mw=r["loss"]["st_mw"],
        total_power_loss_mw=r["loss"]["total_mw"],
        excess_pressure_mbar=r["excess_pressure"]["mbar"],
        excess_stack_c=r["excess_stack_c"],
        monthly_loss_krw=r["monthly_loss_krw"],
        annual_revenue_loss_krw=r["annual_loss_krw"],
    )


def _recovery(r: dict) -> RecoveryEstimate:
    dm = r["default_method"]
    after = dm["values_after"]
    return RecoveryEstimate(
        method_id=dm["id"],
        name=dm["name"],
        recovered_power_mw=dm["recovered_mw"],
        loss_after_mw=dm["loss_after"]["total_mw"],
        monthly_recovery_krw=dm["monthly_recovery_krw"],
        annual_recovery_krw=dm["annual_recovery_krw"],
        recovery_rate_pct=dm["recovery_vs_loss"] * 100,
        expected_bp_after_mbar=after["gt_bp_mbar"],
        expected_dp_after_mbar=after["hrsg_dp_mbar"],
        expected_stack_temp_after_c=after["stack_c"],
    )


def _pct(x: float | None) -> float | None:
    return None if x is None else x * 100


def _efficiency(r: dict, ki: dict, trend: dict | None, D: dict) -> EfficiencyEstimate:
    e = r["efficiency"]
    kpi = ki["kpi"]["heat_recovery_eff"]
    drop = D["constants"]["efficiency_drop_pp"]
    design = _pct(e["design"])
    return EfficiencyEstimate(
        current_pct=_pct(e["now"]),
        after_cleaning_pct=_pct(e["after"]),
        design_pct=design,
        vs_design_pp=kpi["vs_design_pp"],
        caution_pct=None if design is None else design - drop["caution"],
        danger_pct=None if design is None else design - drop["danger"],
        status=kpi["level"],
        trend=[TrendPoint(x=m["month"], y=m["eff"] * 100) for m in trend["months"]] if trend else [],
    )


def _methods(r: dict) -> list[CleaningMethodComparison]:
    cmp = r["methods"]
    rows = []
    for m in cmp["rows"]:
        base = {"method_id": m["id"], "name": m["name"]}
        if not m["available"]:
            rows.append(CleaningMethodComparison(**base, available=False, missing=m["missing"]))
            continue
        rows.append(
            CleaningMethodComparison(
                **base,
                available=True,
                cost_krw=m["cost_krw"],
                downtime_days=m["outage_days"],
                indirect_krw=m["indirect_krw"],
                expected_recovery_pct=_pct(m["recovery_ratio"]),
                recovered_power_mw=m["recovered_mw"],
                recovery_basis=m["recovery_basis"],
                outage_loss_krw=m["outage_loss_krw"],
                total_investment_krw=m["total_investment_krw"],
                monthly_benefit_krw=m["monthly_benefit_krw"],
                annual_benefit_krw=m["annual_benefit_krw"],
                payback_months=m["payback_months"],
                breakeven_days=m["breakeven_days"],
                first_month_net_krw=m["first_month_net_krw"],
                net_benefit_krw=m["annual_net_krw"],
                max_net_benefit=m["id"] == cmp["max_net_benefit_id"],
                best_payback=m["id"] == cmp["best_payback_id"],
            )
        )
    return rows


def _pinch(s: dict) -> PinchApproachEvaluation:
    status = "insufficient_data" if s["level"] == "no_data" else s["level"]
    cur = s["current"] or {}
    return PinchApproachEvaluation(
        section=s["label"],
        pinch_c=cur.get("pinch_c"),
        approach_c=cur.get("approach_c"),
        design_pinch_c=s["design"]["pinch_c"],
        design_approach_c=s["design"]["approach_c"],
        saturation_temp_c=s.get("t_sat_c"),
        status=status,
        message=s["message"],
        checklist_category=s["checklist_category"],
    )


def _key_indicators(ki: dict, r: dict) -> KeyIndicators:
    kpi = ki["kpi"]
    return KeyIndicators(
        overall_status=kpi["overall"]["level"],
        hp_steam_tph=kpi["hp_steam_tph"]["value"],
        cleaning_method_id=r["default_method"]["id"],
        cleaning_method_name=r["default_method"]["name"],
        cleaning_cost_krw=kpi["cleaning_cost_krw"]["value"],
        payback_months=kpi["payback_months"]["value"],
    )


def _sensitivity(curve: dict) -> SensitivitySeries:
    return SensitivitySeries(
        points=[TrendPoint(x=p["value"]["mbar"], y=p["loss_mw"]) for p in curve["points"]],
        current_x=curve["current"]["mbar"],
        design_x=curve["design"]["mbar"],
        caution_x=curve["caution"]["mbar"],
        danger_x=curve["danger"]["mbar"],
    )
