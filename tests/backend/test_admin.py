"""관리자 모드 API — 로그인, 참고문헌 목록·검사·서지 편집, 시스템 상태."""

import json
import logging
from pathlib import Path

import pytest

from app.admin import auth, references
from app.config import Settings, get_settings

PASSWORD = "test-admin-pw"


def _doc(doc_id: str, title: str, n_paras: int, **meta) -> dict:
    return {
        "document": {
            "doc_id": doc_id, "title": title, "authors": meta.get("authors", ["A. Kim"]), "year": meta.get("year", 2020),
            "venue": meta.get("venue", "Energy"), "doi": "", "url": "", "license": "", "source_type": "paraphrase", "lang": "en",
        },
        "paragraphs": [
            {"id": f"{doc_id}-{i:03d}", "doc_id": doc_id, "section": "Intro", "page_start": i, "page_end": i,
             "text": f"text {i}", "terms": [], "content_type": "text", "source_type": "paraphrase"}
            for i in range(1, n_paras + 1)
        ],
        "report": {},
    }


@pytest.fixture
def corpus(tmp_path: Path) -> dict[str, Path]:
    src = tmp_path / "rag_corpus"
    src.mkdir()
    docs = {
        "R001": _doc("R001", "", 1, authors=[], year=None, venue=""),
        "R002": _doc("R002", "HRSG fouling (Final Report)", 3, venue="대한설비공학회 [판독 불가] 논문집"),
    }
    for doc_id, d in docs.items():
        (src / f"{doc_id}.json").write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    mapping = [{"doc_id": k, "source_file": f"{k.lower()}.pdf", **{f: d["document"][f] for f in ("title", "authors", "year")},
                "paragraph_count": len(d["paragraphs"])} for k, d in docs.items()]
    (src / "doc_id_mapping.json").write_text(json.dumps(mapping, ensure_ascii=False), encoding="utf-8")
    corpus_all = tmp_path / "corpus_all.json"
    corpus_all.write_text(json.dumps({
        "documents": [d["document"] for d in docs.values()],
        "paragraphs": [p for d in docs.values() for p in d["paragraphs"]],
    }, ensure_ascii=False), encoding="utf-8")
    return {"dir": src, "all": corpus_all}


@pytest.fixture
def admin(client, corpus):
    settings = Settings(admin_password=PASSWORD, rag_corpus_dir=corpus["dir"], rag_corpus_all_path=corpus["all"],
                        rag_api_url="http://127.0.0.1:9")
    client.app.dependency_overrides[get_settings] = lambda: settings
    auth.throttle = auth.LoginThrottle()
    return client


def _login(client) -> dict:
    res = client.post("/api/admin/login", json={"password": PASSWORD})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


# ---- 로그인 ----
def test_disabled_without_password(client):
    client.app.dependency_overrides[get_settings] = lambda: Settings(admin_password="")
    assert client.get("/api/admin/config").json() == {"enabled": False}
    res = client.post("/api/admin/login", json={"password": "x"})
    assert res.status_code == 403 and res.json()["error"]["code"] == "ADMIN_DISABLED"
    assert client.get("/api/admin/status").status_code == 403


def test_login_and_token_required(admin):
    assert admin.get("/api/admin/config").json() == {"enabled": True}
    assert admin.get("/api/admin/references").json()["error"]["code"] == "ADMIN_UNAUTHORIZED"
    assert admin.get("/api/admin/references", headers={"Authorization": "Bearer 99999999999.forged"}).status_code == 401
    bad = admin.post("/api/admin/login", json={"password": "wrong"})
    assert bad.status_code == 401 and bad.json()["error"]["code"] == "ADMIN_BAD_PASSWORD"
    assert admin.get("/api/admin/references", headers=_login(admin)).status_code == 200


def test_repeated_failures_lock_login(admin):
    for _ in range(auth.MAX_FAILURES):
        admin.post("/api/admin/login", json={"password": "wrong"})
    res = admin.post("/api/admin/login", json={"password": PASSWORD})
    assert res.status_code == 429 and res.json()["error"]["code"] == "ADMIN_LOCKED"


def test_token_expires_and_is_bound_to_password():
    token, _ = auth.issue_token(PASSWORD, hours=1, now=1_000_000)
    assert auth.verify_token(PASSWORD, token, now=1_000_100) is not None
    assert auth.verify_token(PASSWORD, token, now=1_000_000 + 3601) is None
    assert auth.verify_token("other-password", token, now=1_000_100) is None


# ---- 참고문헌 ----
def test_list_references_with_issues(admin):
    data = admin.get("/api/admin/references", headers=_login(admin)).json()
    assert data["configured"] is True
    docs = {d["docId"]: d for d in data["documents"]}
    assert docs["R002"]["paragraphCount"] == 3 and docs["R002"]["pages"] == "1–3"
    assert docs["R002"]["sourceFile"] == "r002.pdf"
    codes = {(i["docId"], i["code"]) for i in data["issues"]}
    assert {("R001", "empty_title"), ("R001", "no_authors"), ("R001", "no_year"), ("R001", "no_venue")} <= codes
    assert ("R002", "unreadable_marker") in codes
    assert not [i for i in data["issues"] if i["level"] == "error"]


def test_validation_errors(admin, corpus):
    bad = _doc("R003", "Dup", 1)
    bad["paragraphs"].append({**bad["paragraphs"][0], "content_type": "image"})  # ID 중복 + 유형 오류
    (corpus["dir"] / "R003.json").write_text(json.dumps(bad), encoding="utf-8")
    (corpus["dir"] / "R004.json").write_text("{not json", encoding="utf-8")
    issues = admin.get("/api/admin/references", headers=_login(admin)).json()["issues"]
    codes = {i["code"] for i in issues if i["level"] == "error"}
    assert {"duplicate_paragraph_id", "invalid_type", "invalid_file"} <= codes
    warn = {(i.get("docId"), i["code"]) for i in issues if i["level"] == "warning"}
    assert ("R003", "mapping_missing") in warn and ("R003", "corpus_all_missing") in warn


def test_update_reference_writes_all_files(admin, corpus, monkeypatch):
    calls = []

    class _Res:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(references.urllib.request, "urlopen", lambda req, timeout: calls.append(req.full_url) or _Res())
    res = admin.patch("/api/admin/references/R001", headers=_login(admin), json={
        "title": "  Dynamic   behavior of a triple-pressure HRSG ", "authors": ["Lee, J.", " ", "Park, S."],
        "year": 2024, "doi": "https://doi.org/10.1/abc", "lang": "ko",
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["document"]["title"] == "Dynamic behavior of a triple-pressure HRSG"
    assert body["document"]["authors"] == ["Lee, J.", "Park, S."] and body["document"]["doi"] == "10.1/abc"
    assert body["ragSync"] == "reloaded" and calls == ["http://127.0.0.1:9/documents/reload"]
    assert {i["code"] for i in body["issues"]} == {"no_venue"}  # 제목·저자·연도 경고는 사라짐

    src = json.loads((corpus["dir"] / "R001.json").read_text(encoding="utf-8"))
    assert src["document"]["title"] == "Dynamic behavior of a triple-pressure HRSG" and src["document"]["year"] == 2024
    assert len(src["paragraphs"]) == 1  # 문단은 그대로
    mapping = json.loads((corpus["dir"] / "doc_id_mapping.json").read_text(encoding="utf-8"))
    assert mapping[0]["title"] == "Dynamic behavior of a triple-pressure HRSG" and mapping[0]["source_file"] == "r001.pdf"
    built = json.loads(corpus["all"].read_text(encoding="utf-8"))
    assert built["documents"][0]["authors"] == ["Lee, J.", "Park, S."]
    # 고친 뒤 corpus_all.json과 문헌 JSON이 어긋나지 않는다
    issues = admin.get("/api/admin/references", headers=_login(admin)).json()["issues"]
    assert not [i for i in issues if i["code"].startswith("corpus_all")]


def test_update_reports_unavailable_search_server(admin):
    res = admin.patch("/api/admin/references/R002", headers=_login(admin), json={"title": "HRSG fouling"})
    assert res.status_code == 200 and res.json()["ragSync"] == "unavailable"


def test_update_rejects_bad_values(admin):
    h = _login(admin)
    assert admin.patch("/api/admin/references/R001", headers=h, json={"title": "  "}).json()["error"]["code"] == "REFERENCE_INVALID_TITLE"
    assert admin.patch("/api/admin/references/R001", headers=h, json={"url": "ftp://x"}).status_code == 422
    assert admin.patch("/api/admin/references/R001", headers=h, json={"year": 3000}).status_code == 422
    assert admin.patch("/api/admin/references/R999", headers=h, json={"title": "x"}).status_code == 404


def test_references_not_configured(client):
    client.app.dependency_overrides[get_settings] = lambda: Settings(admin_password=PASSWORD, rag_corpus_dir=None)
    auth.throttle = auth.LoginThrottle()
    h = _login(client)
    data = client.get("/api/admin/references", headers=h).json()
    assert data["configured"] is False and data["documents"] == []
    assert client.patch("/api/admin/references/R001", headers=h, json={"title": "x"}).status_code == 409


# ---- 시스템 상태 ----
def test_status_hides_secrets_and_collects_warnings(client):
    client.app.dependency_overrides[get_settings] = lambda: Settings(
        admin_password=PASSWORD, llm_provider="claude", llm_api_key="sk-secret", rag_api_url="http://127.0.0.1:9")
    auth.throttle = auth.LoginThrottle()
    logging.getLogger("app.test").warning("검색 API 호출 실패 테스트")
    res = client.get("/api/admin/status", headers=_login(client))
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["llm"] == {"provider": "claude", "model": "claude-sonnet-5-5", "keySet": True, "fallbackModels": [], "logPrompts": False}
    assert data["rag"]["api"]["reachable"] is False
    assert data["recentLogs"][0]["message"] == "검색 API 호출 실패 테스트"
    assert "sk-secret" not in res.text and PASSWORD not in res.text
