"""관리자 시스템 상태 — 설정·연결 상태를 모은다. 비밀 값(API 키, 비밀번호)은 설정 여부만 내보낸다."""

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from app.admin.logbuffer import recent_logs
from app.chat.llm import claude, gemini
from app.config import Settings
from app.domain.models.admin import AdminStatus, LlmStatus, RagApiStatus, RagStatus, ReferencesStatus
from app.rag.store import resolve_docs_dir

STARTED_AT = datetime.now(UTC)
VERSION = "0.1.0"


def _llm(settings: Settings) -> LlmStatus:
    defaults = {"claude": claude.DEFAULT_MODEL, "gemini": gemini.DEFAULT_MODEL}
    fallbacks = [m.strip() for m in settings.llm_fallback_models.split(",") if m.strip()]
    return LlmStatus(
        provider=settings.llm_provider,
        model=(settings.llm_model or defaults.get(settings.llm_provider)) if settings.llm_provider != "fake" else None,
        key_set=bool(settings.llm_api_key),
        fallback_models=fallbacks if settings.llm_provider == "gemini" else [],
        log_prompts=settings.log_prompts,
    )


def rag_api_status(url: str, timeout_s: float = 3.0) -> RagApiStatus:
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/health", timeout=timeout_s) as res:
            h = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return RagApiStatus(url=url, reachable=False, error=f"HTTP {e.code}")
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
        reason = getattr(e, "reason", e)
        return RagApiStatus(url=url, reachable=False, error=str(reason)[:200])
    corpus = h.get("corpus") or {}
    return RagApiStatus(
        url=url,
        reachable=True,
        documents=corpus.get("documents"),
        paragraphs=corpus.get("paragraphs"),
        methods={str(k): bool(v) for k, v in (h.get("methods") or {}).items()},
        missing={str(k): str(v) for k, v in (h.get("missing") or {}).items()},
    )


def collect(settings: Settings, session_expires_at: datetime) -> AdminStatus:
    docs_dir, docs_mock = resolve_docs_dir(settings.docs_masked_dir)
    keyword_docs = sum(1 for p in docs_dir.glob("*.md") if p.name.lower() != "readme.md")
    corpus_dir = settings.rag_corpus_dir
    return AdminStatus(
        version=VERSION,
        started_at=STARTED_AT,
        calc_engine=settings.calc_engine,
        data_source=settings.data_source,
        llm=_llm(settings),
        rag=RagStatus(
            retriever=settings.rag_retriever,
            docs="mock" if docs_mock else "real",
            keyword_docs=keyword_docs,
            api=rag_api_status(settings.rag_api_url),
        ),
        references=ReferencesStatus(
            configured=bool(corpus_dir and corpus_dir.is_dir()),
            corpus_dir=str(corpus_dir) if corpus_dir else None,
            corpus_all_path=str(settings.rag_corpus_all_path) if settings.rag_corpus_all_path else None,
        ),
        recent_logs=recent_logs.recent(),
        session_expires_at=session_expires_at,
    )
