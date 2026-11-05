"""최근 경고·오류 로그를 메모리에 모아 관리자 시스템 상태에 보여 준다(재시작하면 비워진다)."""

import logging
from collections import deque
from datetime import UTC, datetime

from app.domain.models.admin import LogEntry

MAX_ENTRIES = 50
MAX_MESSAGE = 500


class RecentLogHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.entries: deque[LogEntry] = deque(maxlen=MAX_ENTRIES)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            message = record.getMessage()
            if record.exc_info and record.exc_info[1] is not None:
                message += f" — {type(record.exc_info[1]).__name__}: {record.exc_info[1]}"
            self.entries.append(
                LogEntry(
                    time=datetime.fromtimestamp(record.created, UTC),
                    level=record.levelname,
                    logger=record.name,
                    message=message[:MAX_MESSAGE],
                )
            )
        except Exception:  # 로그 수집 실패가 요청을 깨뜨리지 않게
            self.handleError(record)

    def recent(self) -> list[LogEntry]:
        return list(reversed(self.entries))


recent_logs = RecentLogHandler()


def install() -> None:
    """앱 로거(root)와 uvicorn 로거(전파하지 않음)에 한 번만 붙인다"""
    for name in ("", "uvicorn"):
        logger = logging.getLogger(name)
        if recent_logs not in logger.handlers:
            logger.addHandler(recent_logs)
