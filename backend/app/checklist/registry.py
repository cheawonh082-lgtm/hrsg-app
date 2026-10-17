"""체크리스트 DI. 저장소는 CHECKLIST_STATE_PATH 파일, 테스트에서는 get_checklist_store를 메모리 구현으로 바꾼다."""

from functools import lru_cache
from pathlib import Path

from fastapi import Depends

from app.checklist.service import ChecklistService, load_template
from app.checklist.store import ChecklistStateStore, JsonFileStateStore
from app.config import Settings, get_settings


@lru_cache
def _file_store(path: Path) -> JsonFileStateStore:
    return JsonFileStateStore(path)


def get_checklist_store(settings: Settings = Depends(get_settings)) -> ChecklistStateStore:
    return _file_store(settings.checklist_state_path)


def get_checklist_service(store: ChecklistStateStore = Depends(get_checklist_store)) -> ChecklistService:
    return ChecklistService(load_template(), store)
