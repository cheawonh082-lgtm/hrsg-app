import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
# 로컬 .env가 실제 LLM을 가리켜도 테스트는 항상 Fake로 — 결정적·무료·키 불필요 (환경변수가 .env보다 우선)
os.environ["LLM_PROVIDER"] = "fake"
# 로컬 .env가 논문 RAG 검색 API를 가리켜도 테스트는 내장 문서 키워드 검색으로 (검색 서버 불필요)
os.environ["RAG_RETRIEVER"] = "keyword"
# 로컬 .env가 관리자 모드를 가리켜도 테스트는 관리자 모드를 비활성화로 (관리자 서버 불필요)
os.environ["ADMIN_PASSWORD"] = ""

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def default_input(client) -> dict:
    res = client.get("/api/calc/defaults", params={"gtModelId": "GT_MOCK_F_CLASS"})
    assert res.status_code == 200
    return res.json()
