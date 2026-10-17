from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import calc, chat, checklist, health
from app.calculator.errors import CalcError
from app.config import get_settings


def _error(status: int, code: str, message_key: str, details: dict | None = None) -> JSONResponse:
    """PRD §7.1 오류 형식: { error: { code, messageKey, details } }"""
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "messageKey": message_key, "details": details or {}}},
    )


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="HRSG Reference API",
        version="0.1.0",
        separate_input_output_schemas=False,  # TS 타입을 CalcInput 하나로 생성
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        # 입력값(input)은 응답에 되돌려주지 않음 — 위치·메시지·유형만
        errors = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
        return _error(422, "VALIDATION_ERROR", "error.validation", {"errors": errors})

    @app.exception_handler(CalcError)
    async def _calc_error(_: Request, exc: CalcError):
        return _error(exc.status_code, exc.code, exc.message_key, exc.details)

    @app.exception_handler(NotImplementedError)
    async def _not_implemented(_: Request, exc: NotImplementedError):
        return _error(501, "NOT_IMPLEMENTED", "error.notImplemented")

    app.include_router(health.router)
    app.include_router(calc.router)
    app.include_router(chat.router)
    app.include_router(checklist.router)
    return app


app = create_app()
