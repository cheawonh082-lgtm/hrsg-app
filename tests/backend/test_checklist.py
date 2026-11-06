"""체크리스트 API 테스트. 항목·진행률·메일 문구는 팀 공통 키트(checklist.py · data/checklist.json)를 따른다.
키트 README 「기대값」(체크리스트·이메일 텍스트)을 API로 확인한다."""

import json

import pytest

from app import kit
from app.checklist.registry import get_checklist_store
from app.checklist.service import ChecklistService
from app.checklist.store import InMemoryStateStore, JsonFileStateStore


@pytest.fixture
def store():
    return InMemoryStateStore()


@pytest.fixture
def api(client, store):
    """실제 상태 파일 대신 메모리 저장소 사용"""
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


# ---- 키트 README 「기대값」 ----
def test_initial_state_matches_kit(api):
    body = get(api)
    assert [c["label"] for c in body["categories"]] == [c["name"] for c in kit.checklist_data()["categories"]]
    assert len(body["items"]) == len(body["states"]) == 49
    p = body["progress"]
    assert (p["percent"], p["checked"], p["total"], p["requiredChecked"], p["requiredTotal"]) == (0, 0, 49, 0, 16)
    assert {c: (v["checked"], v["total"]) for c, v in p["byCategory"].items()} == {
        "A": (0, 6), "B": (0, 13), "C": (0, 9), "D": (0, 3), "E": (0, 18),
    }
    assert sum(i["required"] for i in body["items"]) == 16
    assert all(s["checked"] is False and s["status"] == "not_entered" for s in body["states"])


def test_item_fields_follow_kit(api):
    items = {i["id"]: i for i in get(api)["items"]}
    assert items["A-05"]["linkedCalcField"] == "monthlyOperatingHours"
    a02 = items["A-02"]
    assert (a02["label"], a02["kind"], a02["priority"], a02["required"]) == ("운전 배압", "operation", "required", True)
    assert a02["detail"] == "초과 배압과 출력 손실 계산 · 단위 mmH₂O 또는 mbar"  # 키트 detail_line
    assert a02["calcInput"] == "equipment.gt_bp" and a02["linkedCalcField"] == "gtBackPressureMbar"
    assert items["A-06"]["calcInput"] == "equipment.base_gt_bp" and items["A-06"]["linkedCalcField"] is None
    assert items["B-13"]["priority"] == "optional" and items["B-09"]["priority"] == "recommended"


def test_check_a01_and_na_b13(api, store):
    patch(api, "A-01", checked=True)
    p = get(api)["progress"]
    assert (p["percent"], p["checked"], p["total"]) == (2, 1, 49)
    patch(api, "B-13", status="na")
    assert get(api)["progress"]["total"] == 48
    # 저장 형식은 키트 progress — 화면 글자가 아니라 키
    assert store.load() == {"A-01": {"supply": "received"}, "B-13": {"supply": "na"}}


def test_search_pinch_finds_five_items():
    C = kit.checklist_data()
    assert len(kit.checklist().filter_items(C, {}, query="핀치")) == 5


def test_email_starts_with_kit_text_and_skips_received(api):
    patch(api, "A-01", checked=True)
    r = export(api)
    assert r["body"].startswith("HRSG 성능 진단을 위해 아래 데이터를 요청드립니다.")
    lines = r["body"].splitlines()
    assert lines[2] == "[A. 가스터빈/운전]"
    assert not any(line.startswith("- A-01 ") for line in lines)
    assert r["itemCount"] == 48


# ---- 상태 변경 ----
def test_uncheck_returns_to_not_entered(api, store):
    patch(api, "A-02", checked=True)
    state = patch(api, "A-02", checked=False)
    assert (state["checked"], state["status"]) == (False, "not_entered")
    assert store.load() == {}


def test_status_and_memo(api, store):
    state = patch(api, "C-03", status="requested", memo="  8월 정비 기간  ")
    assert (state["status"], state["memo"], state["checked"]) == ("requested", "8월 정비 기간", False)
    assert store.load()["C-03"] == {"supply": "requested", "note": "8월 정비 기간"}
    assert patch(api, "C-03", memo="")["memo"] is None


def test_invalid_saved_entries_reset_to_initial(api, store):
    """불러올 때 validate_progress 오류(모르는 ID, 화면 글자로 저장한 상태)는 그 항목만 처음 상태로"""
    store.save("gt_model", {"supply": "received"})
    store.save("A-03", {"supply": "수령 완료"})
    store.save("A-04", {"supply": "received", "checked": True})  # 모르는 필드는 버리고 상태는 유지
    states = {s["itemId"]: s for s in get(api)["states"]}
    assert states["A-03"]["status"] == "not_entered"
    assert states["A-04"]["status"] == "received"
    assert "gt_model" not in states


def test_patch_unknown_item_404(api):
    res = api.patch("/api/checklist/items/nope", json={"checked": True})
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "UNKNOWN_CHECKLIST_ITEM"


@pytest.mark.parametrize("body", [{"status": "done"}, {"status": "수령 완료"}, {"memo": "x" * 501}, {"checked": "maybe"}])
def test_patch_validation_error(api, body):
    res = api.patch("/api/checklist/items/A-01", json=body)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_reset(api):
    patch(api, "A-01", checked=True)
    assert api.post("/api/checklist/reset").status_code == 204
    assert get(api)["progress"]["checked"] == 0


# ---- 메일 범위·언어 ----
def test_email_scopes(api):
    patch(api, "A-02", checked=True)
    patch(api, "B-13", status="na")
    assert export(api, scope="all")["itemCount"] == 48  # 해당 없음만 빠짐
    required = export(api, scope="required_only")
    assert required["itemCount"] == 15 and "- A-02 " not in required["body"]
    assert all("[필수]" in line for line in required["body"].splitlines() if line.startswith("- "))


def test_english_screen_shows_kit_text(api):
    """키트에 한국어 문구만 있어 영어 화면에서도 키트 문구 그대로"""
    body = get(api, "en")
    assert body["categories"][0]["label"] == "A. 가스터빈/운전"
    assert next(i for i in body["items"] if i["id"] == "A-02")["label"] == "운전 배압"


def test_email_redacts_real_names(api, monkeypatch):
    C = json.loads(json.dumps(kit.checklist_data()))
    C["items"][0]["name"] = "가상그린발전소 2호기 GT 모델"
    monkeypatch.setattr(kit, "checklist_data", lambda: C)
    body = export(api)["body"]
    assert "가상그린" not in body and "PLANT-A UNIT-X" in body


def test_email_when_nothing_left(api):
    for item in get(api)["items"]:
        patch(api, item["id"], checked=True)
    r = export(api, scope="unchecked")
    assert r["itemCount"] == 0
    assert r["body"].startswith("HRSG 성능 진단을 위해")


# ---- 저장소 ----
def test_json_file_store_survives_reload(tmp_path):
    path = tmp_path / "state.json"
    JsonFileStateStore(path).save("A-01", {"supply": "received"})
    assert JsonFileStateStore(path).load() == {"A-01": {"supply": "received"}}
    assert json.loads(path.read_text(encoding="utf-8")) == {"A-01": {"supply": "received"}}


def test_json_file_store_tolerates_corrupt_file(tmp_path):
    path = tmp_path / "state.json"
    path.write_text("{not json", encoding="utf-8")
    assert JsonFileStateStore(path).load() == {}


def test_old_format_state_file_starts_fresh(tmp_path):
    """이전 체크리스트(항목 ID gt.model …) 상태 파일은 키트 검사에서 모두 걸러진다"""
    path = tmp_path / "state.json"
    path.write_text(json.dumps({"gt.model": {"itemId": "gt.model", "checked": True, "status": "received"}}), encoding="utf-8")
    service = ChecklistService(JsonFileStateStore(path))
    assert service.progress() == {}
