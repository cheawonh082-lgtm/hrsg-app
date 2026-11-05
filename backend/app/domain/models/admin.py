"""관리자 모드 API 스키마 — 로그인, 참고문헌(논문 RAG 코퍼스) 관리, 시스템 상태."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from .base import CamelModel


# ---- 로그인 ----
class AdminConfig(CamelModel):
    enabled: bool  # ADMIN_PASSWORD가 설정돼 있을 때만 true


class AdminLoginRequest(CamelModel):
    password: str = Field(..., min_length=1, max_length=200)


class AdminSession(CamelModel):
    token: str
    expires_at: datetime


# ---- 참고문헌 ----
class ReferenceDoc(CamelModel):
    doc_id: str
    title: str
    authors: list[str]
    year: int | None
    venue: str
    doi: str
    url: str
    lang: str
    license: str
    source_type: str
    source_file: str  # 원본 PDF 파일명 (관리자에게만 보인다)
    paragraph_count: int
    pages: str | None  # 문단이 걸친 쪽 범위 "1–12"


IssueCode = Literal[
    # 오류: 코퍼스를 만들 수 없음
    "invalid_file",
    "missing_field",
    "duplicate_doc_id",
    "duplicate_paragraph_id",
    "doc_id_mismatch",
    "invalid_type",
    # 경고: 출처 표시·검색 품질 문제
    "empty_text",
    "mapping_missing",
    "paragraph_count_mismatch",
    "empty_title",
    "no_authors",
    "no_year",
    "no_venue",
    "unreadable_marker",
    "corpus_all_missing",
    "corpus_all_stale",
    "corpus_all_paragraphs_mismatch",
]


class ReferenceIssue(CamelModel):
    level: Literal["error", "warning"]
    code: IssueCode
    doc_id: str | None = None
    paragraph_id: str | None = None
    field: str | None = None
    detail: str | None = None


class ReferenceList(CamelModel):
    configured: bool  # RAG_CORPUS_DIR가 설정돼 있고 폴더가 있는지
    corpus_dir: str | None
    corpus_all_path: str | None
    documents: list[ReferenceDoc]
    issues: list[ReferenceIssue]


class ReferencePatch(CamelModel):
    """서지 정보 편집 — 보낸 필드만 바꾼다"""

    title: str | None = Field(default=None, max_length=500)
    authors: list[str] | None = Field(default=None, max_length=100)
    year: int | None = Field(default=None, ge=1800, le=2100)
    venue: str | None = Field(default=None, max_length=500)
    doi: str | None = Field(default=None, max_length=200)
    url: str | None = Field(default=None, max_length=1000)
    lang: Literal["ko", "en"] | None = None


RagSync = Literal["reloaded", "unavailable", "rejected", "not_configured"]


class ReferenceUpdateResult(CamelModel):
    document: ReferenceDoc
    issues: list[ReferenceIssue]  # 이 문헌의 남은 문제
    # 검색 서버 반영: reloaded 즉시 반영 · unavailable 서버 꺼짐(다음 시작 때 반영) · rejected 서버가 거절 · not_configured corpus_all 경로 없음
    rag_sync: RagSync


# ---- 시스템 상태 ----
class LlmStatus(CamelModel):
    provider: str
    model: str | None
    key_set: bool  # 키 값은 내보내지 않는다
    fallback_models: list[str]
    log_prompts: bool


class RagApiStatus(CamelModel):
    url: str
    reachable: bool
    documents: int | None = None
    paragraphs: int | None = None
    methods: dict[str, bool] = {}
    missing: dict[str, str] = {}
    error: str | None = None


class RagStatus(CamelModel):
    retriever: Literal["keyword", "api"]
    docs: Literal["mock", "real"]  # keyword 모드의 문서: 내장 예시 문서 / 인제스트된 문서
    keyword_docs: int  # keyword 모드 문서 수
    api: RagApiStatus


class ReferencesStatus(CamelModel):
    configured: bool
    corpus_dir: str | None
    corpus_all_path: str | None


class LogEntry(CamelModel):
    time: datetime
    level: str
    logger: str
    message: str


class AdminStatus(CamelModel):
    version: str
    started_at: datetime
    calc_engine: Literal["mock", "real"]
    data_source: Literal["mock", "real"]
    llm: LlmStatus
    rag: RagStatus
    references: ReferencesStatus
    recent_logs: list[LogEntry]  # 최근 경고·오류 (최신순)
    session_expires_at: datetime
