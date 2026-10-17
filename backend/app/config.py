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
    llm_provider: str = "fake"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
