"""계산기 API 테스트. 계산은 팀 공통 키트(hrsg_calc_kit_team2/calc.py)가 하고,
여기서는 어댑터·API가 키트 결과를 그대로 옮기는지 키트 README 「기대값」 표로 확인한다."""

import copy

import pytest

from app import kit
from app.calculator.kit_adapter import to_kit_input
from app.calculator.real import RealCalculator
from app.calculator.registry import get_calculator
from app.domain.models.calc import CalcInput, CalcResult


def evaluate(client, payload: dict) -> dict:
    res = client.post("/api/calc/evaluate", json=payload)
    assert res.status_code == 200, res.text
    return res.json()


def defaults(client, model="GT_MOCK_F_CLASS", preset="example") -> dict:
    res = client.get("/api/calc/defaults", params={"gtModelId": model, "preset": preset})
    assert res.status_code == 200, res.text
    return res.json()


def with_condition(payload: dict, **changes) -> dict:
    p = copy.deepcopy(payload)
    p["condition"].update(changes)
    return p


def strip_meta(result: dict) -> dict:
    r = copy.deepcopy(result)
    for volatile in ("calcId", "computedAt"):
        r["meta"].pop(volatile)
    return r


def by_key(items: list[dict], key: str, field: str = "key") -> dict:
    return next(i for i in items if i[field] == key)


# ---- 참조 데이터 엔드포인트 ----
def test_health_reports_mock(client):
    body = client.get("/api/health").json()
    assert body["engine"] == "mock"
    assert body["isMock"] is True


def test_gt_models_come_from_kit(client):
    models = client.get("/api/calc/gt-models").json()
    assert [m["modelId"] for m in models] == ["GT_MOCK_F_CLASS", "GT_MOCK_H_CLASS", "GT_MOCK_E_CLASS"]
    assert [m["displayName"] for m in models] == [g["name"] for g in kit.calculator_data()["gt_classes"]]
    assert models[0]["ratedPowerMw"] == 270 and models[0]["ratedStMw"] == 135


def test_defaults_unknown_model_returns_error_format(client):
    res = client.get("/api/calc/defaults", params={"gtModelId": "NOPE"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "UNKNOWN_GT_MODEL"


def test_defaults_are_kit_example_and_design_states(client):
    ex = defaults(client)["condition"]
    assert (ex["gtBackPressureMbar"], ex["hrsgGasDpMbar"], ex["stackTempC"]) == (30, 30, 95)  # 키트 default_case
    assert ex["hpSteamTph"] == 270
    design = defaults(client, preset="design")["condition"]
    assert (design["gtBackPressureMbar"], design["hrsgGasDpMbar"], design["stackTempC"]) == (30, 25, 90)
    assert defaults(client)["economics"] == {
        "electricityPriceKrwPerMwh": 150000, "monthlyOperatingHours": 720, "annualOperatingHours": 8000,
    }


@pytest.mark.parametrize("model", ["GT_MOCK_F_CLASS", "GT_MOCK_H_CLASS", "GT_MOCK_E_CLASS"])
@pytest.mark.parametrize("preset", ["example", "design"])
def test_adapter_output_passes_kit_validation(client, model, preset):
    """키트 규칙: 어댑터 결과는 validateInputs 의 오류·경고가 0개"""
    D = kit.calculator_data()
    k = to_kit_input(CalcInput.model_validate(defaults(client, model, preset)), D)
    check = kit.calc().validate_inputs(k, D)
    assert check["errors"] == [] and check["warnings"] == []


def test_input_limits_mirror_pydantic_ranges(client):
    limits = client.get("/api/calc/input-limits").json()
    c, e = limits["condition"], limits["economics"]
    assert c["exhaustTempC"] == {
        "min": 450, "max": 680, "exclusiveMin": False, "exclusiveMax": False, "integer": False, "nullable": False,
    }
    assert c["gtLoadPct"]["min"] == 30
    assert c["exhaustFlowKgS"]["exclusiveMin"] is True
    assert c["hpSteamTph"]["nullable"] is True
    assert e["annualOperatingHours"]["integer"] is True
    assert (e["monthlyOperatingHours"]["min"], e["monthlyOperatingHours"]["max"]) == (1, 744)
    assert e["electricityPriceKrwPerMwh"]["exclusiveMin"] is True


# ---- evaluate 계약 ----
def test_schema_conformance_and_camel_case(client, default_input):
    result = evaluate(client, default_input)
    CalcResult.model_validate(result)
    assert "totalPowerLossMw" in result["loss"]
    assert "total_power_loss_mw" not in result["loss"]
    assert result["meta"]["isMock"] is True
    assert result["meta"]["engineVersion"] == kit.calculator_data()["engine"]


def test_deterministic(client, default_input):
    assert strip_meta(evaluate(client, default_input)) == strip_meta(evaluate(client, default_input))


# ---- 키트 README 「기대값」 ----
def test_tab1_example_state(client, default_input):
    r = evaluate(client, default_input)
    m = {x["key"]: x for x in r["current"]["metrics"]}
    assert [(m[k]["value"], m[k]["status"]) for k in ("gtBackPressure", "hrsgGasDp", "stackTemp")] == [
        (30, "normal"), (30, "caution"), (95, "normal"),
    ]
    assert r["current"]["overallStatus"] == "caution"
    assert round(r["current"]["foulingIndex"]) == 41
    loss = r["loss"]
    assert (round(loss["totalPowerLossMw"], 2), round(loss["gtPowerLossMw"], 2), round(loss["stPowerLossMw"], 2)) == (1.89, 1.08, 0.81)
    assert round(loss["annualRevenueLossKrw"] / 1e8, 2) == 22.68
    rec = r["recovery"]
    assert (rec["methodId"], rec["name"]) == ("mechanical", "기계식 세정")  # 키트 공법 이름 그대로
    assert (round(rec["recoveredPowerMw"], 2), round(rec["annualRecoveryKrw"] / 1e8, 2), round(rec["recoveryRatePct"])) == (0.85, 10.21, 45)
    eff = r["efficiency"]
    assert (round(eff["currentPct"], 1), round(eff["afterCleaningPct"], 1), round(eff["designPct"], 1)) == (86.3, 86.7, 87.2)


def test_tab1_design_reset(client):
    r = evaluate(client, defaults(client, preset="design"))
    assert r["loss"]["totalPowerLossMw"] == 0
    assert round(r["current"]["foulingIndex"]) == 0
    assert r["current"]["overallStatus"] == "normal"


def test_tab1_graphs(client, default_input):
    r = evaluate(client, default_input)
    trend = r["efficiency"]["trend"]
    assert len(trend) == 13
    assert (round(trend[0]["y"], 1), round(trend[-1]["y"], 1)) == (87.2, 86.3)
    s = r["sensitivity"]
    assert (s["points"][0]["x"], round(s["points"][0]["y"], 2)) == (15, 0.81)
    assert (s["points"][-1]["x"], round(s["points"][-1]["y"], 2)) == (40, 4.05)
    assert (s["cautionX"], s["dangerX"], s["currentX"]) == (27.5, 32.5, 30)


def test_tab2_example_state(client, default_input):
    rows = {m["methodId"]: m for m in evaluate(client, default_input)["cleaningComparison"]}
    assert [m for m, row in rows.items() if row["maxNetBenefit"]] == ["chemical"]
    assert round(rows["chemical"]["netBenefitKrw"] / 1e8, 2) == 11.86
    order = ("mechanical", "water", "dryice", "chemical")
    assert [round(rows[m]["totalInvestmentKrw"] / 1e8, 2) for m in order] == [3.25, 4.04, 4.46, 7.42]
    assert [round(rows[m]["paybackMonths"], 2) for m in order] == [3.54, 3.30, 3.12, 4.27]


def test_tab2_design_reset(client):
    rows = evaluate(client, defaults(client, preset="design"))["cleaningComparison"]
    assert all(r["netBenefitKrw"] < 0 for r in rows)
    assert all(r["paybackMonths"] is None for r in rows)
    assert not any(r["maxNetBenefit"] for r in rows)


def test_tab3_example_state(client, default_input):
    r = evaluate(client, default_input)
    hp, ip, lp = (by_key(r["pinchApproach"], s, "section") for s in ("HP", "IP", "LP"))
    assert (round(hp["pinchC"], 1), round(hp["approachC"], 1), hp["status"]) == (8.0, 5.0, "normal")
    assert ip["status"] == lp["status"] == "insufficient_data" and ip["checklistCategory"] == "B"
    k = r["keyIndicators"]
    assert k["overallStatus"] == "caution"
    assert k["hpSteamTph"] == 270
    assert round(r["efficiency"]["vsDesignPp"], 2) == -0.85
    assert round(k["cleaningCostKrw"] / 1e8, 2) == 3.25 and round(k["paybackMonths"], 2) == 3.54


def test_monthly_hours_drive_monthly_amounts_and_payback(client, default_input):
    """월간 가동시간은 월간 금액·회수기간에, 연간 운전시간은 연간 금액에만 쓰인다 (키트)"""
    base = evaluate(client, default_input)
    p = copy.deepcopy(default_input)
    p["economics"]["monthlyOperatingHours"] = 360
    half = evaluate(client, p)
    assert half["loss"]["monthlyLossKrw"] == pytest.approx(base["loss"]["monthlyLossKrw"] / 2)
    assert half["loss"]["annualRevenueLossKrw"] == base["loss"]["annualRevenueLossKrw"]
    mech = lambda r: by_key(r["cleaningComparison"], "mechanical", "methodId")["paybackMonths"]  # noqa: E731
    assert mech(half) == pytest.approx(mech(base) * 2)

    p = copy.deepcopy(default_input)
    p["economics"]["monthlyOperatingHours"] = 745
    assert client.post("/api/calc/evaluate", json=p).status_code == 422


# ---- 입력 → 결과 방향 ----
def test_loss_monotonic_in_dp(client, default_input):
    losses = [evaluate(client, with_condition(default_input, hrsgGasDpMbar=dp))["loss"]["totalPowerLossMw"] for dp in (25, 30, 35)]
    assert losses == sorted(losses) and losses[0] < losses[-1]


@pytest.mark.parametrize("model", ["GT_MOCK_H_CLASS", "GT_MOCK_E_CLASS"])
def test_other_classes_evaluate(client, model):
    assert evaluate(client, defaults(client, model))["input"]["gtModelId"] == model


# ---- 입력 검증 ----
@pytest.mark.parametrize(
    "field,value",
    [("exhaustTempC", 800), ("gtLoadPct", 10), ("stackTempC", 20), ("hrsgGasDpMbar", -1)],
)
def test_out_of_range_input_returns_422(client, default_input, field, value):
    res = client.post("/api/calc/evaluate", json=with_condition(default_input, **{field: value}))
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "VALIDATION_ERROR"
    assert any(field in e["loc"] for e in err["details"]["errors"])


def test_unknown_model_returns_422(client, default_input):
    p = copy.deepcopy(default_input)
    p["gtModelId"] = "NOPE"
    res = client.post("/api/calc/evaluate", json=p)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "UNKNOWN_GT_MODEL"


def test_kit_rejection_returns_422_with_kit_message(client, default_input):
    """증발기 출구 가스 온도가 포화온도보다 낮으면 키트가 계산을 거부한다"""
    res = client.post("/api/calc/evaluate", json=with_condition(default_input, hpEvapGasOutTempC=200))
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "CALC_INPUT_INVALID"
    assert "포화온도" in err["details"]["messages"][0]


def test_pinch_missing_inputs_is_insufficient_data(client, default_input):
    p = copy.deepcopy(default_input)
    for key in ("hpDrumPressureBarg", "hpEvapGasOutTempC", "hpEcoWaterOutTempC"):
        p["condition"].pop(key)
    r = evaluate(client, p)
    hp = by_key(r["pinchApproach"], "HP", "section")
    assert hp["status"] == "insufficient_data" and hp["pinchC"] is None


# ---- 엔진 교체 ----
def test_real_engine_returns_501_until_implemented(client, default_input):
    client.app.dependency_overrides[get_calculator] = lambda: RealCalculator()
    res = client.post("/api/calc/evaluate", json=default_input)
    assert res.status_code == 501
    assert res.json()["error"]["code"] == "NOT_IMPLEMENTED"


# ---- 결과 세션 캐시 (A-09 기반) ----
def test_result_retrievable_by_calc_id(client, default_input):
    result = evaluate(client, default_input)
    res = client.get(f"/api/calc/results/{result['meta']['calcId']}")
    assert res.status_code == 200
    assert res.json() == result


def test_unknown_calc_id_returns_404_error_format(client):
    res = client.get("/api/calc/results/does-not-exist")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "CALC_RESULT_NOT_FOUND"


def test_result_cache_evicts_oldest():
    from types import SimpleNamespace

    from app.calculator.result_cache import CalcResultCache

    cache = CalcResultCache(max_size=2)
    results = {cid: CalcResult.model_construct(meta=SimpleNamespace(calc_id=cid)) for cid in ("a", "b", "c")}
    for r in results.values():
        cache.put(r)
    assert cache.get("a") is None
    assert cache.get("b") is results["b"]
    assert cache.get("c") is results["c"]
