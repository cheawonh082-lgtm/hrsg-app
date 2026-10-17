import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

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
