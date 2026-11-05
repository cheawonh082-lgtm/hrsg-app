"""관리자 로그인 — ADMIN_PASSWORD 하나로 들어가고, 서명된 만료 토큰(Bearer)을 쓴다.

- ADMIN_PASSWORD가 비어 있으면 관리자 모드 자체가 꺼진다(403 ADMIN_DISABLED).
- 토큰 = "<만료 시각(초)>.<HMAC>" — 서버에 세션을 저장하지 않는다. 서명 키는 비밀번호와 프로세스마다 새로 만든 값으로 만들므로
  비밀번호를 바꾸거나 서버를 재시작하면 기존 토큰은 모두 무효가 된다.
- 같은 IP에서 연속으로 틀리면 잠시 막는다(429 ADMIN_LOCKED).
"""

import hashlib
import hmac
import secrets
import threading
import time
from datetime import UTC, datetime

from fastapi import Depends, Header, Request

from app.config import Settings, get_settings

_PROCESS_SALT = secrets.token_bytes(32)
MAX_FAILURES = 5
LOCK_SECONDS = 600


class AdminError(Exception):
    def __init__(self, status_code: int, code: str, message_key: str):
        self.status_code = status_code
        self.code = code
        self.message_key = message_key


def _key(password: str) -> bytes:
    return hashlib.sha256(_PROCESS_SALT + password.encode("utf-8")).digest()


def _sign(password: str, exp: int) -> str:
    return hmac.new(_key(password), str(exp).encode(), hashlib.sha256).hexdigest()


def issue_token(password: str, hours: float, now: float | None = None) -> tuple[str, datetime]:
    exp = int((now or time.time()) + hours * 3600)
    return f"{exp}.{_sign(password, exp)}", datetime.fromtimestamp(exp, UTC)


def verify_token(password: str, token: str, now: float | None = None) -> datetime | None:
    """유효하면 만료 시각, 아니면 None"""
    exp_s, _, sig = token.partition(".")
    if not exp_s.isdigit() or not sig:
        return None
    exp = int(exp_s)
    if exp < (now or time.time()) or not hmac.compare_digest(sig, _sign(password, exp)):
        return None
    return datetime.fromtimestamp(exp, UTC)


class LoginThrottle:
    """IP별 연속 실패 횟수 — 성공하면 초기화"""

    def __init__(self) -> None:
        self._failures: dict[str, tuple[int, float]] = {}
        self._lock = threading.Lock()

    def check(self, ip: str, now: float | None = None) -> None:
        now = now or time.time()
        with self._lock:
            count, since = self._failures.get(ip, (0, now))
            if count >= MAX_FAILURES and now - since < LOCK_SECONDS:
                raise AdminError(429, "ADMIN_LOCKED", "admin.errors.ADMIN_LOCKED")
            if now - since >= LOCK_SECONDS:
                self._failures.pop(ip, None)

    def fail(self, ip: str, now: float | None = None) -> None:
        now = now or time.time()
        with self._lock:
            count, since = self._failures.get(ip, (0, now))
            self._failures[ip] = (count + 1, since)

    def reset(self, ip: str) -> None:
        with self._lock:
            self._failures.pop(ip, None)


throttle = LoginThrottle()


def login(password: str, request: Request, settings: Settings) -> tuple[str, datetime]:
    if not settings.admin_password:
        raise AdminError(403, "ADMIN_DISABLED", "admin.errors.ADMIN_DISABLED")
    ip = request.client.host if request.client else "?"
    throttle.check(ip)
    if not hmac.compare_digest(password.encode("utf-8"), settings.admin_password.encode("utf-8")):
        throttle.fail(ip)
        raise AdminError(401, "ADMIN_BAD_PASSWORD", "admin.errors.ADMIN_BAD_PASSWORD")
    throttle.reset(ip)
    return issue_token(settings.admin_password, settings.admin_session_hours)


def require_admin(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> datetime:
    """관리자 API 의존성 — 세션 만료 시각을 돌려준다"""
    if not settings.admin_password:
        raise AdminError(403, "ADMIN_DISABLED", "admin.errors.ADMIN_DISABLED")
    scheme, _, token = (authorization or "").partition(" ")
    expires = verify_token(settings.admin_password, token.strip()) if scheme.lower() == "bearer" else None
    if expires is None:
        raise AdminError(401, "ADMIN_UNAUTHORIZED", "admin.errors.ADMIN_UNAUTHORIZED")
    return expires
