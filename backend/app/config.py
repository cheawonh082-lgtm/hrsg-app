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
    llm_provider: Literal["fake", "claude", "gemini"] = "fake"
    llm_model: str = ""
    llm_api_key: str = ""
    # 주 모델이 과부하·한도 초과일 때 차례로 시도할 모델 (쉼표 구분, 현재 gemini만 사용)
    llm_fallback_models: str = ""
    log_prompts: bool = False

    # RAG 문서 — docs_masked_dir에 인제스트 결과가 있으면 그것을, 없으면 내장 Mock 문서를 쓴다
    docs_raw_dir: Path = _ROOT_DIR / "data" / "docs_raw"
    docs_masked_dir: Path = _ROOT_DIR / "data" / "docs_masked"
    # keyword: 위 문서 폴더의 키워드 검색 / api: 논문 RAG 검색 API(hrsg-explorer-rag, uvicorn api.app:app)
    rag_retriever: Literal["keyword", "api"] = "keyword"
    rag_api_url: str = "http://127.0.0.1:8100"
    rag_api_method: Literal["1", "2", "3", "4"] = "4"  # 1: bge+BM25, 2: qwen+BM25, 3: 둘 다+BM25, 4: 3안+언어별 가중
    rag_api_top_n: int = 5
    rag_api_timeout_s: float = 60.0  # 첫 질문은 임베딩 모델을 불러오느라 오래 걸릴 수 있다

    # 체크리스트 진행 상태 (재시작해도 유지, Git 제외)
    checklist_state_path: Path = _ROOT_DIR / "data" / "checklist_state.json"

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
