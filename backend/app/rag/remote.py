"""논문 RAG 검색 API(hrsg-explorer-rag) 클라이언트 — RAG_RETRIEVER=api.

POST {RAG_API_URL}/search {"query", "method", "top_n"} → 문단 목록. 문단마다 논문명(title)·절·본문이 온다.
- 출처는 서지 정보(저자·연도·논문명·발행처·쪽)로 표시한다. doc_alias는 문서 ID(R014)로 같은 논문을 묶는 데만 쓴다.
- 배포판은 같은 형식의 Cloudflare Worker(hrsg-explorer-rag/cloudflare/worker)를 쓰고, RAG_API_KEY를 Bearer로 붙인다.
- 교차언어 검색이 목적이므로 질문 언어로 문단을 거르지 않는다(lang 인자는 무시).
- API에 연결할 수 없으면 '자료 없음'으로 답하지 않도록 RetrieverUnavailableError(503)를 낸다.
"""

import json
import logging
import urllib.error
import urllib.request

from app.chat.llm.base import LLMUnavailableError
from app.rag.retriever import Retriever, SearchHit
from app.rag.store import Chunk

log = logging.getLogger(__name__)


USER_AGENT = "hrsg-reference-app/0.1"


def api_headers(api_key: str) -> dict[str, str]:
    """검색 API 요청 헤더.
    - Cloudflare는 Python 기본 User-Agent(Python-urllib)를 봇으로 막으므로(오류 1010) 앱 이름을 붙인다.
    - 배포판 검색 Worker는 비밀키가 필요하다(RAG_API_KEY). 로컬 RAG API는 키 없이 받는다."""
    headers = {"User-Agent": USER_AGENT}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


class RetrieverUnavailableError(LLMUnavailableError):
    """검색 API 호출 실패 — LLM 오류와 같은 경로(503 + messageKey)로 화면에 안내한다."""


class ApiRetriever(Retriever):
    is_mock = False
    default_top_k = 5
    citation_style = "titles"

    def __init__(self, base_url: str, method: str = "4", top_n: int = 5, timeout_s: float = 60.0, api_key: str = ""):
        self._url = base_url.rstrip("/") + "/search"
        self._method = method
        self.default_top_k = top_n
        self._timeout = timeout_s
        self._headers = api_headers(api_key)

    def search(self, query: str, top_k: int = 5, lang: str | None = None) -> list[SearchHit]:
        body = json.dumps({"query": query, "method": self._method, "top_n": top_k}).encode("utf-8")
        req = urllib.request.Request(self._url, data=body, headers={"Content-Type": "application/json", **self._headers})
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as res:
                results = json.loads(res.read().decode("utf-8"))["results"]
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as e:
            log.warning("RAG API 호출 실패: %s", e)
            raise RetrieverUnavailableError("RAG_UNAVAILABLE", "chat.errors.RAG_UNAVAILABLE") from e
        if not results:
            return []
        top = results[0]["score"] or 1.0
        return [
            SearchHit(
                Chunk(
                    doc_alias=r["doc_id"],
                    title=r.get("title") or r["doc_id"],
                    section_title=r.get("section") or None,
                    text=r["text"],
                    lang=r.get("lang"),
                    authors=tuple(r.get("authors") or ()),
                    year=r.get("year"),
                    venue=r.get("venue") or None,
                    pages=_pages(r.get("page_start"), r.get("page_end")),
                    url=r.get("url") or (f"https://doi.org/{r['doi']}" if r.get("doi") else None),
                ),
                round(r["score"] / top, 3),  # RRF 점수를 1위 대비 비율(0~1)로
            )
            for r in results
        ]


def _pages(start: int | None, end: int | None) -> str | None:
    if not start:
        return None
    return str(start) if not end or end == start else f"{start}–{end}"
