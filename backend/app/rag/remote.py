"""논문 RAG 검색 API(hrsg-explorer-rag) 클라이언트 — RAG_RETRIEVER=api.

POST {RAG_API_URL}/search {"query", "method", "top_n"} → 문단 목록. 문단마다 논문명(title)·절·본문이 온다.
- 출처는 논문명으로 표시한다(Chunk.doc_alias = 논문명, 원문 파일명은 쓰지 않음).
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


class RetrieverUnavailableError(LLMUnavailableError):
    """검색 API 호출 실패 — LLM 오류와 같은 경로(503 + messageKey)로 화면에 안내한다."""


class ApiRetriever(Retriever):
    is_mock = False
    default_top_k = 5
    citation_style = "titles"

    def __init__(self, base_url: str, method: str = "4", top_n: int = 5, timeout_s: float = 60.0):
        self._url = base_url.rstrip("/") + "/search"
        self._method = method
        self.default_top_k = top_n
        self._timeout = timeout_s

    def search(self, query: str, top_k: int = 5, lang: str | None = None) -> list[SearchHit]:
        body = json.dumps({"query": query, "method": self._method, "top_n": top_k}).encode("utf-8")
        req = urllib.request.Request(self._url, data=body, headers={"Content-Type": "application/json"})
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
                    doc_alias=r.get("title") or r["doc_id"],
                    title=r.get("title") or r["doc_id"],
                    section_title=r.get("section") or None,
                    text=r["text"],
                    lang=r.get("lang"),
                ),
                round(r["score"] / top, 3),  # RRF 점수를 1위 대비 비율(0~1)로
            )
            for r in results
        ]
