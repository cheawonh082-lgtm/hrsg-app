"""체크리스트 진행 상태 저장소. 단일 사용자 PoC라 상태는 전체 하나다.

저장 형식은 키트와 같다: { "A-01": { "supply": "received", "note": "…" } } (키트 README 작업 목록 6).
- JsonFileStateStore: 기본. 서버를 재시작해도 유지. 파일은 Git 제외(메모에 고객 정보가 들어갈 수 있음).
- InMemoryStateStore: 테스트용.
DB로 옮길 때는 ChecklistStateStore를 구현해 registry에서 바꾼다.
"""

import json
import os
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path
from threading import Lock

Progress = dict[str, dict]  # 키트 progress


class ChecklistStateStore(ABC):
    @abstractmethod
    def load(self) -> Progress: ...

    @abstractmethod
    def save(self, item_id: str, entry: dict | None) -> None:
        """entry가 None이면 그 항목을 처음 상태로."""

    @abstractmethod
    def clear(self) -> None: ...


class InMemoryStateStore(ChecklistStateStore):
    def __init__(self) -> None:
        self._progress: Progress = {}

    def load(self) -> Progress:
        return {k: dict(v) for k, v in self._progress.items()}

    def save(self, item_id: str, entry: dict | None) -> None:
        if entry:
            self._progress[item_id] = dict(entry)
        else:
            self._progress.pop(item_id, None)

    def clear(self) -> None:
        self._progress.clear()


class JsonFileStateStore(ChecklistStateStore):
    def __init__(self, path: Path):
        self._path = path
        self._lock = Lock()

    def load(self) -> Progress:
        with self._lock:
            return self._read()

    def save(self, item_id: str, entry: dict | None) -> None:
        with self._lock:
            progress = self._read()
            if entry:
                progress[item_id] = entry
            else:
                progress.pop(item_id, None)
            self._write(progress)

    def clear(self) -> None:
        with self._lock:
            self._write({})

    def _read(self) -> Progress:
        if not self._path.is_file():
            return {}
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}  # 손상된 파일은 빈 상태로 시작(다음 저장 때 덮어씀)
        return raw if isinstance(raw, dict) else {}

    def _write(self, progress: Progress) -> None:
        """임시 파일에 쓴 뒤 교체 — 쓰는 도중 중단돼도 기존 파일이 깨지지 않는다."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self._path.parent, prefix=".checklist-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(progress, f, ensure_ascii=False, indent=2)
            os.replace(tmp, self._path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
