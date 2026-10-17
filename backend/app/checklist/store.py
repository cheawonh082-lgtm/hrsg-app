"""체크리스트 진행 상태 저장소. 단일 사용자 PoC라 상태는 전체 하나다.

- JsonFileStateStore: 기본. 서버를 재시작해도 유지(K-01). 파일은 Git 제외(메모에 고객 정보가 들어갈 수 있음).
- InMemoryStateStore: 테스트용.
DB로 옮길 때는 ChecklistStateStore를 구현해 registry에서 바꾼다.
"""

import json
import os
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path
from threading import Lock

from app.domain.models.checklist import ChecklistItemState


class ChecklistStateStore(ABC):
    @abstractmethod
    def load(self) -> dict[str, ChecklistItemState]: ...

    @abstractmethod
    def save(self, state: ChecklistItemState) -> None: ...

    @abstractmethod
    def clear(self) -> None: ...


class InMemoryStateStore(ChecklistStateStore):
    def __init__(self) -> None:
        self._states: dict[str, ChecklistItemState] = {}

    def load(self) -> dict[str, ChecklistItemState]:
        return dict(self._states)

    def save(self, state: ChecklistItemState) -> None:
        self._states[state.item_id] = state

    def clear(self) -> None:
        self._states.clear()


class JsonFileStateStore(ChecklistStateStore):
    def __init__(self, path: Path):
        self._path = path
        self._lock = Lock()

    def load(self) -> dict[str, ChecklistItemState]:
        with self._lock:
            return self._read()

    def save(self, state: ChecklistItemState) -> None:
        with self._lock:
            states = self._read()
            states[state.item_id] = state
            self._write(states)

    def clear(self) -> None:
        with self._lock:
            self._write({})

    def _read(self) -> dict[str, ChecklistItemState]:
        if not self._path.is_file():
            return {}
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}  # 손상된 파일은 빈 상태로 시작(다음 저장 때 덮어씀)
        return {k: ChecklistItemState.model_validate(v) for k, v in raw.items()}

    def _write(self, states: dict[str, ChecklistItemState]) -> None:
        """임시 파일에 쓴 뒤 교체 — 쓰는 도중 중단돼도 기존 파일이 깨지지 않는다."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        data = {k: v.model_dump(mode="json", by_alias=True) for k, v in states.items()}
        fd, tmp = tempfile.mkstemp(dir=self._path.parent, prefix=".checklist-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp, self._path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
