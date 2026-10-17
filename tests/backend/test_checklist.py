"""체크리스트 API 테스트 (PRD §6.3 C: K-01~K-04, §7.1 API)."""

import json

import pytest

from app.checklist.registry import get_checklist_store
from app.checklist.service import compute_progress, load_template
from app.checklist.store import InMemoryStateStore, JsonFileStateStore
from app.domain.models.checklist import ChecklistItemState


@pytest.fixture
def api(client):
    """실제 상태 파일 대신 메모리 저장소 사용"""
    store = InMemoryStateStore()
    client.app.dependency_overrides[get_checklist_store] = lambda: store
    return client


def get(api, locale="ko") -> dict:
    res = api.get("/api/checklist", params={"locale": locale})
    assert res.status_code == 200, res.text
    return res.json()


def patch(api, item_id: str, **body) -> dict:
    res = api.patch(f"/api/checklist/items/{item_id}", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def export(api, **body) -> dict:
    res = api.post("/api/checklist/export-email", json=body)
    assert res.status_code == 200, res.text
    return res.json()


# ---- GET ----
def test_get_returns_items_states_progress(api):
    body = get(api)
    assert [c["id"] for c in body["categories"]] == [
        "gas_turbine", "exhaust_gas", "feedwater_steam", "pinch_approach",
        "design_docs", "maintenance_history", "economics",
    ]
    assert len(body["items"]) == len(body["states"]) == 26
    item = next(i for i in body["items"] if i["id"] == "exh.hrsg_dp")
    assert item["label"] == "HRSG 입·출구 가스 차압"
    assert item["linkedCalcField"] == "hrsgGasDpMbar"
    assert item["priority"] == "required" and item["kind"] == "operating"
    assert all(s["checked"] is False and s["status"] == "pending" for s in body["states"])
    p = body["progress"]
    assert (p["total"], p["checked"], p["requiredTotal"], p["percent"]) == (26, 0, 13, 0)


def test_get_english_text(api):
    body = get(api, "en")
    assert body["categories"][0]["label"] == "Gas turbine"
    assert next(i for i in body["items"] if i["id"] == "fw.stack_temp")["label"] == "Stack temperature"


def test_linked_calc_fields_exist_in_calculator_input(api):
    from app.domain.models.calc import EconomicParams, OperatingCondition

    fields = set(OperatingCondition.model_json_schema(by_alias=True)["properties"]) | set(
        EconomicParams.model_json_schema(by_alias=True)["properties"]
    )
    linked = {i["linkedCalcField"] for i in get(api)["items"] if i["linkedCalcField"]}
    assert linked <= fields
    assert {"hpEvapGasOutTempC", "hpEcoWaterOutTempC"} <= linked  # 핀치 '데이터 필요' → 체크리스트


# ---- PATCH (K-01) ----
def test_patch_updates_state_and_progress(api):
    state = patch(api, "gt.model", checked=True, status="received", memo="  설계서 수령  ")
    assert state["checked"] is True and state["status"] == "received"
    assert state["memo"] == "설계서 수령"
    assert state["updatedAt"]

    p = get(api)["progress"]
    assert (p["checked"], p["requiredChecked"]) == (1, 1)
    assert p["byCategory"]["gas_turbine"] == {"total": 4, "checked": 1}
    assert p["percent"] == round(1 / 26 * 100)


def test_patch_only_changes_sent_fields(api):
    patch(api, "exh.temp", memo="DCS 태그 확인 중")
    state = patch(api, "exh.temp", status="requested")
    assert state["memo"] == "DCS 태그 확인 중" and state["status"] == "requested"


def test_na_items_excluded_from_progress(api):
    patch(api, "doc.pid", status="na")
    p = get(api)["progress"]
    assert p["total"] == 25
    assert p["byCategory"]["design_docs"]["total"] == 2


def test_patch_unknown_item_404(api):
    res = api.patch("/api/checklist/items/nope", json={"checked": True})
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "UNKNOWN_CHECKLIST_ITEM"


@pytest.mark.parametrize("body", [{"status": "done"}, {"memo": "x" * 501}, {"checked": "maybe"}])
def test_patch_validation_error(api, body):
    res = api.patch("/api/checklist/items/gt.model", json=body)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_reset(api):
    patch(api, "gt.model", checked=True)
    assert api.post("/api/checklist/reset").status_code == 204
    assert get(api)["progress"]["checked"] == 0


# ---- export-email (K-02~K-04) ----
def test_export_unchecked_ko(api):
    patch(api, "gt.model", checked=True, status="received")
    patch(api, "doc.pid", status="na")
    r = export(api, scope="unchecked", locale="ko")
    assert r["subject"] == "[HRSG 성능 진단] 플랜트 데이터 요청드립니다"
    body = r["body"]
    assert body.startswith("안녕하세요, 고객사 담당자님.")
    assert "■ 가스터빈" in body and "1. 부하별 운전 이력 [필수] — 최근 12개월, 1시간 평균, 단위: %" in body
    assert "GT 모델 및 정격 출력" not in body  # 완료 항목 제외
    assert "P&ID" not in body  # 해당 없음 제외
    assert r["itemCount"] == 24
    assert body.rstrip().endswith("회신 가능 일정을 알려주시면 감사하겠습니다.")


def test_export_numbering_is_continuous_across_categories(api):
    body = export(api, scope="all")["body"]
    numbers = [int(line.strip().split(".")[0]) for line in body.splitlines() if line.startswith("  ") and line.strip()[0].isdigit()]
    assert numbers == list(range(1, 27))


def test_export_required_only(api):
    patch(api, "exh.hrsg_dp", checked=True)
    r = export(api, scope="required_only")
    assert r["itemCount"] == 12
    assert "[권장]" not in r["body"] and "[선택]" not in r["body"]


def test_export_english_and_alias(api):
    body = export(api, scope="all", locale="en", recipientAlias="plant_operations")["body"]
    assert body.startswith("Dear Plant operations team,")
    assert "■ Gas turbine" in body and "[Required]" in body


def test_export_memo_optional_and_redacted(api):
    patch(api, "gt.back_pressure", memo="가상그린발전소 2호기 기준")
    without = export(api, includeMemo=False)["body"]
    assert "가상그린" not in without and "메모" not in without
    with_memo = export(api, includeMemo=True)["body"]
    assert "(메모: PLANT-A UNIT-X 기준)" in with_memo
    assert "가상그린" not in with_memo  # K-04 실명 미포함


def test_export_rejects_free_text_recipient(api):
    res = api.post("/api/checklist/export-email", json={"recipientAlias": "홍길동 부장"})
    assert res.status_code == 422


def test_export_when_nothing_left(api):
    for item in get(api)["items"]:
        patch(api, item["id"], checked=True)
    r = export(api, scope="unchecked")
    assert r["itemCount"] == 0 and "현재 요청할 자료가 없습니다." in r["body"]


# ---- 저장소·템플릿 ----
def test_json_file_store_survives_reload(tmp_path):
    path = tmp_path / "state.json"
    JsonFileStateStore(path).save(ChecklistItemState(item_id="gt.model", checked=True, status="received"))
    assert JsonFileStateStore(path).load()["gt.model"].checked is True
    assert json.loads(path.read_text(encoding="utf-8"))["gt.model"]["status"] == "received"


def test_json_file_store_tolerates_corrupt_file(tmp_path):
    path = tmp_path / "state.json"
    path.write_text("{not json", encoding="utf-8")
    assert JsonFileStateStore(path).load() == {}


def test_templates_have_text_for_every_item():
    template = load_template()
    for locale in ("ko", "en"):
        text = template.locale_text(locale)
        assert {i["id"] for i in template.items} == set(text["items"])
        assert set(template.categories) == set(text["categories"])


def test_compute_progress_empty():
    p = compute_progress([], [], ["gas_turbine"])
    assert p.percent == 0 and p.total == 0
