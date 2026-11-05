"""관리자 모드 API — /api/admin/*. config·login 외에는 모두 Bearer 토큰이 필요하다."""

from datetime import datetime

from fastapi import APIRouter, Depends, Request

from app.admin import auth, status
from app.admin.auth import AdminError, require_admin
from app.admin.references import ReferenceInvalid, ReferenceNotFound, ReferenceStore
from app.config import Settings, get_settings
from app.domain.models.admin import (
    AdminConfig,
    AdminLoginRequest,
    AdminSession,
    AdminStatus,
    ReferenceList,
    ReferencePatch,
    ReferenceUpdateResult,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def get_reference_store(settings: Settings = Depends(get_settings)) -> ReferenceStore | None:
    d = settings.rag_corpus_dir
    if not d or not d.is_dir():
        return None
    return ReferenceStore(d, settings.rag_corpus_all_path, settings.rag_api_url)


@router.get("/config", response_model=AdminConfig)
def config(settings: Settings = Depends(get_settings)):
    return AdminConfig(enabled=bool(settings.admin_password))


@router.post("/login", response_model=AdminSession)
def login(req: AdminLoginRequest, request: Request, settings: Settings = Depends(get_settings)):
    token, expires_at = auth.login(req.password, request, settings)
    return AdminSession(token=token, expires_at=expires_at)


@router.get("/status", response_model=AdminStatus)
def system_status(expires_at: datetime = Depends(require_admin), settings: Settings = Depends(get_settings)):
    return status.collect(settings, expires_at)


@router.get("/references", response_model=ReferenceList)
def list_references(
    _: datetime = Depends(require_admin),
    settings: Settings = Depends(get_settings),
    store: ReferenceStore | None = Depends(get_reference_store),
):
    corpus_all = str(settings.rag_corpus_all_path) if settings.rag_corpus_all_path else None
    if store is None:
        return ReferenceList(configured=False, corpus_dir=None, corpus_all_path=corpus_all, documents=[], issues=[])
    loaded = store.load()
    return ReferenceList(
        configured=True,
        corpus_dir=str(store.corpus_dir),
        corpus_all_path=corpus_all,
        documents=loaded.docs,
        issues=loaded.issues,
    )


@router.patch("/references/{doc_id}", response_model=ReferenceUpdateResult)
def update_reference(
    doc_id: str,
    patch: ReferencePatch,
    _: datetime = Depends(require_admin),
    store: ReferenceStore | None = Depends(get_reference_store),
):
    if store is None:
        raise AdminError(409, "REFERENCES_NOT_CONFIGURED", "admin.errors.REFERENCES_NOT_CONFIGURED")
    try:
        doc, issues, rag_sync = store.update(doc_id, patch)
    except ReferenceNotFound:
        raise AdminError(404, "REFERENCE_NOT_FOUND", "admin.errors.REFERENCE_NOT_FOUND") from None
    except ReferenceInvalid as e:
        raise AdminError(422, f"REFERENCE_INVALID_{e.field.upper()}", f"admin.errors.REFERENCE_INVALID_{e.field.upper()}") from None
    return ReferenceUpdateResult(document=doc, issues=issues, rag_sync=rag_sync)
