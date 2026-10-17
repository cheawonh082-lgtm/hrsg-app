"""챗 구성요소 선택 (DI). 계산기 registry.py와 같은 방식 — 환경변수로 구현체를 고른다.

- LLM_PROVIDER: fake(기본) | claude
- 문서: DOCS_MASKED_DIR에 인제스트 결과가 있으면 실제 문서, 없으면 내장 Mock 문서
- RAG_RETRIEVER: keyword(기본). 임베딩 검색 추가 시 여기서 분기
"""

from functools import lru_cache
from pathlib import Path

from fastapi import Depends

from app.chat.llm.base import LLMProvider
from app.chat.llm.claude import ClaudeProvider
from app.chat.llm.fake import FakeLLMProvider
from app.config import Settings, get_settings
from app.guardrails.redactor import Redactor
from app.rag.retriever import KeywordRetriever, Retriever
from app.rag.store import load_chunks, resolve_docs_dir


def get_llm(settings: Settings = Depends(get_settings)) -> LLMProvider:
    if settings.llm_provider == "claude":
        return ClaudeProvider(settings.llm_api_key, settings.llm_model)
    return FakeLLMProvider()


@lru_cache
def _redactor(secrets_dir: Path) -> Redactor:
    return Redactor.load(secrets_dir)


def get_redactor(settings: Settings = Depends(get_settings)) -> Redactor:
    return _redactor(settings.secrets_dir)


@lru_cache
def _keyword_retriever(docs_masked_dir: Path, secrets_dir: Path) -> KeywordRetriever:
    docs_dir, is_mock = resolve_docs_dir(docs_masked_dir)
    return KeywordRetriever(load_chunks(docs_dir, _redactor(secrets_dir)), is_mock=is_mock)


def get_retriever(settings: Settings = Depends(get_settings)) -> Retriever:
    # 인제스트 후에는 서버를 재시작해야 새 문서가 색인된다
    return _keyword_retriever(settings.docs_masked_dir, settings.secrets_dir)
