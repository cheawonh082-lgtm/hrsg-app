"""계산기 API 계약 테스트 (PRD §4.4). 모든 CalculatorService 구현체가 통과해야 한다."""

import copy

import pytest

from app.calculator.real import RealCalculator
from app.calculator.reference_data.mock import MockReferenceData
from app.calculator.registry import get_calculator
from app.domain.models.calc import CalcResult


def evaluate(client, payload: dict) -> dict:
    res = client.post("/api/calc/evaluate", json=payload)
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


# ---- 참조 데이터 엔드포인트 ----
def test_health_reports_mock(client):
    body = client.get("/api/health").json()
    assert body["engine"] == "mock"
    assert body["isMock"] is True


def test_gt_models_list(client):
    models = client.get("/api/calc/gt-models").json()
    assert {m["modelId"] for m in models} >= {"GT_MOCK_F_CLASS", "GT_MOCK_H_CLASS"}
    assert "ratedPowerMw" in models[0]


def test_defaults_unknown_model_returns_error_format(client):
    res = client.get("/api/calc/defaults", params={"gtModelId": "NOPE"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "UNKNOWN_GT_MODEL"


def test_thresholds(client):
    th = client.get("/api/calc/thresholds").json()
    assert set(th) == {"hrsgGasDp", "stackTemp", "gtBackPressure", "pinch"}
    for band in th.values():
        assert band["caution"] < band["danger"]


def test_input_limits_mirror_pydantic_ranges(client):
    limits = client.get("/api/calc/input-limits").json()
    c, e = limits["condition"], limits["economics"]
    assert c["exhaustTempC"] == {
        "min": 450, "max": 680, "exclusiveMin": False, "exclusiveMax": False, "integer": False, "nullable": False,
    }
    assert c["gtLoadPct"]["min"] == 30
    assert c["exhaustFlowKgS"]["exclusiveMin"] is True
    assert c["hpDrumPressureBarg"]["nullable"] is True
    assert e["analysisPeriodYears"]["integer"] is True
    assert e["electricityPriceKrwPerMwh"]["exclusiveMin"] is True


# ---- evaluate 계약 ----
def test_schema_conformance_and_camel_case(client, default_input):
    result = evaluate(client, default_input)
    CalcResult.model_validate(result)  # 스키마 적합성
    assert "totalPowerLossMw" in result["loss"]
    assert "total_power_loss_mw" not in result["loss"]
    assert result["meta"]["isMock"] is True
    assert result["meta"]["engine"] == "mock"


def test_accepts_snake_case_input(client, default_input):
    snake = {
        "gt_model_id": default_input["gtModelId"],
        "condition": {
            "gt_load_pct": 100, "ambient_temp_c": 15, "exhaust_temp_c": 600, "exhaust_flow_kg_s": 650,
            "gt_back_pressure_mbar": 30, "hrsg_gas_dp_mbar": 25, "stack_temp_c": 90,
        },
        "economics": {"electricity_price_krw_per_mwh": 130000},
    }
    assert evaluate(client, snake)["loss"]["totalPowerLossMw"] == 0


def test_design_point_is_normal_with_no_loss(client, default_input):
    result = evaluate(client, default_input)
    assert result["current"]["overallStatus"] == "normal"
    assert result["loss"]["totalPowerLossMw"] == 0
    assert not any(m["recommended"] for m in result["cleaningComparison"])


def test_deterministic(client, default_input):
    a = evaluate(client, default_input)
    b = evaluate(client, default_input)
    assert strip_meta(a) == strip_meta(b)
    assert a["meta"]["calcId"] != b["meta"]["calcId"]


def test_loss_monotonic_in_dp(client, default_input):
    losses = [
        evaluate(client, with_condition(default_input, hrsgGasDpMbar=dp))["loss"]["totalPowerLossMw"]
        for dp in (20, 25, 30, 35, 45, 60)
    ]
    assert losses == sorted(losses)
    assert losses[-1] > losses[0]


def test_loss_monotonic_in_stack_temp(client, default_input):
    losses = [
        evaluate(client, with_condition(default_input, stackTempC=t))["loss"]["stPowerLossMw"]
        for t in (90, 100, 110, 130)
    ]
    assert losses == sorted(losses)


@pytest.mark.parametrize("dp,stack", [(25, 90), (35, 110), (60, 150)])
def test_recovery_not_greater_than_loss(client, default_input, dp, stack):
    r = evaluate(client, with_condition(default_input, hrsgGasDpMbar=dp, stackTempC=stack))
    assert r["recovery"]["recoveredPowerMw"] <= r["loss"]["totalPowerLossMw"]
    assert r["recovery"]["annualRecoveryKrw"] <= r["loss"]["annualRevenueLossKrw"]


def test_fouled_state_escalates_status(client, default_input):
    r = evaluate(client, with_condition(default_input, hrsgGasDpMbar=35, stackTempC=110))
    assert r["current"]["overallStatus"] == "danger"  # ΔP +40% > 25%, 스택 +20℃ > 15℃
    assert sum(m["recommended"] for m in r["cleaningComparison"]) == 1
    assert 0 < r["current"]["foulingIndex"] <= 100


def test_sensitivity_series(client, default_input):
    s = evaluate(client, with_condition(default_input, hrsgGasDpMbar=35))["sensitivity"]
    xs = [p["x"] for p in s["points"]]
    ys = [p["y"] for p in s["points"]]
    assert xs == sorted(xs) and ys == sorted(ys)
    assert xs[0] <= s["currentX"] <= xs[-1]


def test_sections_cover_gas_path(client, default_input):
    sections = evaluate(client, default_input)["sections"]
    assert sections[0]["sectionId"] == "HP_SH"
    assert sections[-1]["sectionId"] == "STACK"
    temps = [s["gasOutTempC"] for s in sections]
    assert temps == sorted(temps, reverse=True)


def test_cleaning_method_filter(client, default_input):
    p = copy.deepcopy(default_input)
    p["cleaningMethodIds"] = ["dry_ice"]
    rows = evaluate(client, p)["cleaningComparison"]
    assert [r["methodId"] for r in rows] == ["dry_ice"]


def test_unknown_cleaning_method_rejected(client, default_input):
    p = copy.deepcopy(default_input)
    p["cleaningMethodIds"] = ["magic"]
    res = client.post("/api/calc/evaluate", json=p)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "UNKNOWN_CLEANING_METHOD"


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


# ---- 핀치 / 어프로치 ----
def test_pinch_evaluated_when_inputs_present(client, default_input):
    hp = evaluate(client, default_input)["pinchApproach"][0]
    assert hp["section"] == "HP"
    assert hp["pinchC"] == pytest.approx(8, abs=0.5)
    assert hp["approachC"] == pytest.approx(5, abs=0.5)
    assert hp["status"] == "normal"


def test_pinch_missing_inputs_is_insufficient_data(client, default_input):
    p = copy.deepcopy(default_input)
    for key in ("hpDrumPressureBarg", "hpEvapGasOutTempC", "hpEcoWaterOutTempC"):
        p["condition"].pop(key)
    hp = evaluate(client, p)["pinchApproach"][0]
    assert hp["status"] == "insufficient_data"
    assert hp["pinchC"] is None


# ---- 엔진 교체 ----
def test_real_engine_returns_501_until_implemented(client, default_input):
    client.app.dependency_overrides[get_calculator] = lambda: RealCalculator(MockReferenceData())
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
