from fastapi import APIRouter, Depends, Response

from app.checklist.email_formatter import format_email
from app.checklist.registry import get_checklist_service
from app.checklist.service import ChecklistService
from app.domain.models.calc import Locale
from app.domain.models.checklist import (
    ChecklistItemPatch,
    ChecklistItemState,
    ChecklistResponse,
    EmailExportRequest,
    EmailExportResult,
)
from app.guardrails.redactor import Redactor
from app.guardrails.registry import get_redactor

router = APIRouter(prefix="/api/checklist", tags=["checklist"])


@router.get("", response_model=ChecklistResponse)
def get_checklist(locale: Locale = "ko", service: ChecklistService = Depends(get_checklist_service)):
    return service.get(locale)


@router.patch("/items/{item_id}", response_model=ChecklistItemState)
def patch_item(item_id: str, patch: ChecklistItemPatch, service: ChecklistService = Depends(get_checklist_service)):
    return service.patch(item_id, patch)


@router.post("/reset", status_code=204, response_class=Response)
def reset(service: ChecklistService = Depends(get_checklist_service)):
    service.reset()


@router.post("/export-email", response_model=EmailExportResult)
def export_email(
    req: EmailExportRequest,
    service: ChecklistService = Depends(get_checklist_service),
    redactor: Redactor = Depends(get_redactor),
):
    return format_email(req, service.template, service.items(req.locale), service.states(), redactor)
