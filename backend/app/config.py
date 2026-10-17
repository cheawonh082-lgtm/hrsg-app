from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ROOT_DIR = _BACKEND_DIR.parent


class Settings(BaseSettings):
    """환경변수 설정. 루트 `.env` → `backend/.env` 순으로 읽음(뒤가 우선)."""

    model_config = SettingsConfigDict(
        env_file=(_ROOT_DIR / ".env", _BACKEND_DIR / ".env"),
        extra="ignore",
    )

    calc_engine: Literal["mock", "real"] = "mock"
    data_source: Literal["mock", "real"] = "mock"
    secrets_dir: Path = _ROOT_DIR / "secrets"

    # LLM — 실제 공급자 연결 전까지 fake (PRD §7.4 #5)
    llm_provider: Literal["fake", "claude"] = "fake"
    llm_model: str = ""
    llm_api_key: str = ""
    log_prompts: bool = False

    # RAG 문서 — docs_masked_dir에 인제스트 결과가 있으면 그것을, 없으면 내장 Mock 문서를 쓴다
    docs_raw_dir: Path = _ROOT_DIR / "data" / "docs_raw"
    docs_masked_dir: Path = _ROOT_DIR / "data" / "docs_masked"
    rag_retriever: Literal["keyword"] = "keyword"

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
