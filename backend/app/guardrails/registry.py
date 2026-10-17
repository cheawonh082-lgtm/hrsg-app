"""가드레일 구성요소 DI — 챗·체크리스트가 같은 마스킹 사전을 쓴다."""

from functools import lru_cache
from pathlib import Path

from fastapi import Depends

from app.config import Settings, get_settings
from app.guardrails.redactor import Redactor


@lru_cache
def redactor_for(secrets_dir: Path) -> Redactor:
    return Redactor.load(secrets_dir)


def get_redactor(settings: Settings = Depends(get_settings)) -> Redactor:
    return redactor_for(settings.secrets_dir)
