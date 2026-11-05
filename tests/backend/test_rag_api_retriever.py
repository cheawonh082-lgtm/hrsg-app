"""논문 RAG 검색 API 연결 (RAG_RETRIEVER=api) — 출처는 논문명만, LLM에는 문단 전문, 검색 서버 장애는 503."""

import io
import json
import urllib.error

import pytest

from app.chat.llm.base import ComposeContext
from app.chat.llm.prompts import COMPOSE_SYSTEM_PAPERS, compose_content, compose_system
from app.chat.registry import get_retriever
from app.domain.models.chat import Citation
from app.main import app
from app.rag import remote
from app.rag.remote import ApiRetriever

LONG_TEXT = (
    "Lowering the pinch point temperature difference increases steam production but requires a larger evaporator "
    "surface. In the reference case the pinch point was 8.5 K and the HP steam flow rose by 3.2 % when it was reduced. "
) * 2
RESULTS = [
    {"rank": 1, "id": "R014-010", "doc_id": "R014", "title": "Optimization of the triple-pressure combined cycle power plant",
     "authors": ["A. Kim", "B. Lee"], "year": 2019, "venue": "Applied Thermal Engineering", "doi": "10.1000/xyz",
     "page_start": 4, "page_end": 5,
     "section": "3.2 Pinch point", "text": LONG_TEXT, "lang": "en", "score": 0.0328},
    {"rank": 2, "id": "R014-011", "doc_id": "R014", "title": "Optimization of the triple-pressure combined cycle power plant",
     "authors": ["A. Kim", "B. Lee"], "year": 2019, "venue": "Applied Thermal Engineering", "doi": "10.1000/xyz",
     "page_start": 7, "page_end": 7,
     "section": "3.3 Results", "text": "Second paragraph of the same paper.", "lang": "en", "score": 0.0164},
    {"rank": 3, "id": "R002-004", "doc_id": "R002", "title": "", "section": "", "text": "핀치 포인트 설명.", "lang": "ko",
     "score": 0.0161},
]


class _Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.fixture
def fake_api(monkeypatch):
    calls = []

    def urlopen(req, timeout):
        calls.append(json.loads(req.data))
        return _Response(json.dumps({"results": RESULTS[: calls[-1]["top_n"]]}).encode("utf-8"))

    monkeypatch.setattr(remote.urllib.request, "urlopen", urlopen)
    return calls


def test_api_retriever_maps_results(fake_api):
    hits = ApiRetriever("http://rag:8100/", method="3", top_n=5).search("핀치 포인트", top_k=3, lang="ko")
    assert fake_api == [{"query": "핀치 포인트", "method": "3", "top_n": 3}]
    assert [h.chunk.doc_alias for h in hits] == ["R014", "R014", "R002"]  # 같은 논문 묶기용 ID
    assert [h.chunk.title for h in hits] == [RESULTS[0]["title"], RESULTS[0]["title"], "R002"]  # 제목 없으면 doc_id
    c = hits[0].chunk
    assert (c.authors, c.year, c.venue, c.pages, c.url) == (
        ("A. Kim", "B. Lee"), 2019, "Applied Thermal Engineering", "4–5", "https://doi.org/10.1000/xyz")
    assert hits[1].chunk.pages == "7" and hits[2].chunk.pages is None
    assert hits[0].score == 1.0 and hits[1].score == 0.5
    assert hits[0].chunk.text == LONG_TEXT  # 전문 유지 (발췌 자르기는 tools에서)


def test_chat_shows_paper_titles_only(client, fake_api):
    app.dependency_overrides[get_retriever] = lambda: ApiRetriever("http://rag:8100", top_n=3)
    res = client.post("/api/chat", json={"sessionId": "s", "message": "HRSG 핀치 포인트를 낮추면 어떻게 되나요?"})
    assert res.status_code == 200
    body = res.json()
    block = next(b for b in body["blocks"] if b["type"] == "citations")
    assert block["style"] == "titles"
    assert {c["docAlias"] for c in block["items"]} == {"R014", "R002"}
    first = block["items"][0]  # 출처 표기용 서지 정보
    assert (first["title"], first["authors"], first["year"], first["pages"]) == (RESULTS[0]["title"], ["A. Kim", "B. Lee"], 2019, "4–5")
    assert all("fullText" not in c for c in block["items"])  # 전문은 응답에 싣지 않는다
    text = " ".join(b["markdown"] for b in body["blocks"] if b["type"] == "text")
    # 본문에는 출처 번호만 — 논문명은 출처 칩·목록이 items[n-1]에서 찾아 보여 준다
    assert "[1]" in text and RESULTS[0]["title"] not in text


def test_rag_server_down_returns_503(client, monkeypatch):
    def down(req, timeout):
        raise urllib.error.URLError("connection refused")

    monkeypatch.setattr(remote.urllib.request, "urlopen", down)
    app.dependency_overrides[get_retriever] = lambda: ApiRetriever("http://rag:8100")
    res = client.post("/api/chat", json={"sessionId": "s", "message": "HRSG 핀치 포인트란?"})
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "RAG_UNAVAILABLE"


def test_paper_prompt_uses_full_text():
    c = Citation(doc_alias="Paper A", section_title="3.2", snippet=LONG_TEXT[:299], score=1.0, full_text=LONG_TEXT)
    ctx = ComposeContext(message="q", locale="ko", intent="knowledge", citations=[c], citation_style="titles")
    assert compose_system(ctx) == COMPOSE_SYSTEM_PAPERS["ko"]
    content = compose_content(ctx)
    assert LONG_TEXT in content and 'paper="Paper A"' in content
    excerpt = ComposeContext(message="q", locale="ko", intent="knowledge", citations=[c])
    assert LONG_TEXT not in compose_content(excerpt) and 'alias="Paper A"' in compose_content(excerpt)


def test_api_key_is_sent_as_bearer(monkeypatch):
    """배포판 검색 Worker는 RAG_API_KEY가 필요하다 — 로컬 RAG API(키 없음)에는 헤더를 붙이지 않는다"""
    seen = []

    def urlopen(req, timeout):
        seen.append(req.get_header("Authorization"))
        assert req.get_header("User-agent") == remote.USER_AGENT  # Cloudflare가 Python 기본 UA를 막는다
        return _Response(json.dumps({"results": RESULTS[:1]}).encode("utf-8"))

    monkeypatch.setattr(remote.urllib.request, "urlopen", urlopen)
    ApiRetriever("https://rag.example.workers.dev", api_key="s3cret").search("pinch point")
    ApiRetriever("http://127.0.0.1:8100").search("pinch point")
    assert seen == ["Bearer s3cret", None]
