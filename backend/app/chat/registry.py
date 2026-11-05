"""챗 구성요소 선택 (DI). 계산기 registry.py와 같은 방식 — 환경변수로 구현체를 고른다.
마스킹(get_redactor)은 체크리스트와 공유하므로 app/guardrails/registry.py에 있다.

- LLM_PROVIDER: fake(기본) | claude | gemini
- 문서: DOCS_MASKED_DIR에 인제스트 결과가 있으면 실제 문서, 없으면 내장 Mock 문서
- RAG_RETRIEVER: keyword(기본) | api (논문 RAG 검색 API, RAG_API_URL)
"""

from functools import lru_cache
from pathlib import Path

from fastapi import Depends

from app.chat.llm.base import LLMProvider
from app.chat.llm.claude import ClaudeProvider
from app.chat.llm.fake import FakeLLMProvider
from app.chat.llm.gemini import GeminiProvider
from app.config import Settings, get_settings
from app.guardrails.registry import redactor_for
from app.rag.remote import ApiRetriever
from app.rag.retriever import KeywordRetriever, Retriever
from app.rag.store import load_chunks, resolve_docs_dir


@lru_cache
def _claude(api_key: str, model: str, log_prompts: bool) -> ClaudeProvider:
    # HTTP 연결 풀을 요청 간에 재사용
    return ClaudeProvider(api_key, model, log_prompts)


@lru_cache
def _gemini(api_key: str, model: str, log_prompts: bool, fallback_models: str) -> GeminiProvider:
    fallbacks = tuple(m.strip() for m in fallback_models.split(",") if m.strip())
    return GeminiProvider(api_key, model, log_prompts, fallbacks)


def get_llm(settings: Settings = Depends(get_settings)) -> LLMProvider:
    if settings.llm_provider == "gemini":
        return _gemini(settings.llm_api_key, settings.llm_model, settings.log_prompts, settings.llm_fallback_models)
    if settings.llm_provider == "claude":
        return _claude(settings.llm_api_key, settings.llm_model, settings.log_prompts)
    return FakeLLMProvider()


@lru_cache
def _keyword_retriever(docs_masked_dir: Path, secrets_dir: Path) -> KeywordRetriever:
    docs_dir, is_mock = resolve_docs_dir(docs_masked_dir)
    return KeywordRetriever(load_chunks(docs_dir, redactor_for(secrets_dir)), is_mock=is_mock)


@lru_cache
def _api_retriever(url: str, method: str, top_n: int, timeout_s: float, api_key: str) -> ApiRetriever:
    return ApiRetriever(url, method, top_n, timeout_s, api_key)


def get_retriever(settings: Settings = Depends(get_settings)) -> Retriever:
    if settings.rag_retriever == "api":
        return _api_retriever(settings.rag_api_url, settings.rag_api_method, settings.rag_api_top_n, settings.rag_api_timeout_s, settings.rag_api_key)
    # 인제스트 후에는 서버를 재시작해야 새 문서가 색인된다
    return _keyword_retriever(settings.docs_masked_dir, settings.secrets_dir)
