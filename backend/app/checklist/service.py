"""체크리스트 — 팀 공통 키트(checklist.py · data/checklist.json)를 쓴다.

- 항목·분류·필수 여부·문구: 키트 데이터 그대로 (키트에 한국어 문구만 있어 영어 화면도 같은 문구).
- 진행률: 키트 summary() (해당 없음은 분모에서 뺌, 필수는 '수령했고 검증 실패 아님').
- 저장: 키트 형식 { id: { supply, note } }. 불러올 때 validate_progress() 오류가 있는 항목만 처음 상태로.
- 메일 문구: 키트 email_draft() 그대로. 메일은 보내지 않고 문구만 만든다.
"""

from app import kit
from app.calculator.errors import CalcError
from app.calculator.kit_adapter import CHECKLIST_FIELD
from app.checklist.store import ChecklistStateStore, Progress
from app.domain.models.calc import Locale
from app.domain.models.checklist import (
    CategoryInfo,
    CategoryProgress,
    ChecklistItem,
    ChecklistItemPatch,
    ChecklistItemState,
    ChecklistProgress,
    ChecklistResponse,
    EmailExportRequest,
    EmailExportResult,
)
from app.guardrails.redactor import Redactor

_KEEP = ("supply", "note")  # 이 화면이 쓰는 키트 progress 필드


class UnknownChecklistItemError(CalcError):
    status_code = 404

    def __init__(self, item_id: str):
        super().__init__("UNKNOWN_CHECKLIST_ITEM", "error.unknownChecklistItem", {"itemId": item_id})


class ChecklistService:
    def __init__(self, store: ChecklistStateStore, data: dict | None = None):
        self.C = data if data is not None else kit.checklist_data()
        self.store = store
        self._ids = [i["id"] for i in self.C["items"]]

    # ---- 진행 상태 ----
    def progress(self) -> Progress:
        """저장된 상태 중 키트 validate_progress()를 통과한 항목만 (오류 항목은 처음 상태로)"""
        ck = kit.checklist()
        valid: Progress = {}
        for item_id, entry in self.store.load().items():
            entry = {k: v for k, v in (entry or {}).items() if k in _KEEP and v is not None}
            if entry and ck.validate_progress(self.C, {item_id: entry})["ok"]:
                valid[item_id] = entry
        return valid

    def states(self, prog: Progress | None = None) -> list[ChecklistItemState]:
        ck = kit.checklist()
        prog = self.progress() if prog is None else prog
        return [
            ChecklistItemState(
                item_id=i,
                checked=ck.is_received(prog, i),
                status=ck.supply_of(prog, i),
                memo=(prog.get(i) or {}).get("note"),
            )
            for i in self._ids
        ]

    def patch(self, item_id: str, patch: ChecklistItemPatch) -> ChecklistItemState:
        if item_id not in self._ids:
            raise UnknownChecklistItemError(item_id)
        ck = kit.checklist()
        prog = self.progress()
        entry = dict(prog.get(item_id) or {})
        changes = patch.model_dump(exclude_unset=True)
        if changes.get("checked") is True:
            entry["supply"] = "received"
        elif changes.get("checked") is False and ck.is_received(prog, item_id):
            entry["supply"] = "not_entered"
        if changes.get("status"):
            entry["supply"] = changes["status"]
        if "memo" in changes:
            memo = (changes["memo"] or "").strip()
            if memo:
                entry["note"] = memo
            else:
                entry.pop("note", None)
        if entry.get("supply") == "not_entered":
            entry.pop("supply")  # 키트 기본값은 저장하지 않는다
        self.store.save(item_id, entry or None)
        prog[item_id] = entry
        return self.states(prog)[self._ids.index(item_id)]

    def reset(self) -> None:
        self.store.clear()  # 키트 reset_progress() = {}

    # ---- 화면 ----
    def get(self, locale: Locale) -> ChecklistResponse:
        prog = self.progress()
        return ChecklistResponse(
            locale=locale,
            categories=[CategoryInfo(id=c["id"], label=c["name"]) for c in self.C["categories"]],
            items=self.items(),
            states=self.states(prog),
            progress=self._summary(prog),
        )

    def items(self) -> list[ChecklistItem]:
        ck = kit.checklist()
        simple = {"필수": "required", "권장": "recommended", "선택": "optional"}  # 키트 priority_label(…, 'simple')
        return [
            ChecklistItem(
                id=i["id"],
                category=i["category"],
                kind=i["kind"],
                required=i["required"],
                priority=simple[ck.priority_label(self.C, i, "simple")],
                priority_level=i["priority"],
                unit=i["unit"] or None,
                calc_input=i.get("calc_input"),
                linked_calc_field=CHECKLIST_FIELD.get(i.get("calc_input") or ""),
                label=i["name"],
                description=i["reason"],
                detail=ck.detail_line(i),
            )
            for i in self.C["items"]
        ]

    def _summary(self, prog: Progress) -> ChecklistProgress:
        s = kit.checklist().summary(self.C, prog)
        return ChecklistProgress(
            total=s["all"]["total"],
            checked=s["all"]["done"],
            required_total=s["required"]["total"],
            required_checked=s["required"]["done"],
            percent=s["all"]["percent"],
            by_category={c["id"]: CategoryProgress(total=c["total"], checked=c["done"]) for c in s["by_category"]},
        )

    # ---- 메일 문구 ----
    def email(self, req: EmailExportRequest, redactor: Redactor) -> EmailExportResult:
        ck = kit.checklist()
        prog = self.progress()
        ids = self._email_ids(req.scope, prog)
        picked = [i for i in self.C["items"] if (i["id"] in ids if ids is not None else not (ck.is_received(prog, i["id"]) or ck.is_na(prog, i["id"])))]
        body = ck.email_draft(self.C, prog, ids=ids)
        # 메모·실명은 넣지 않지만, 항목 문구에 실명이 섞여 들어올 경우를 막는다
        return EmailExportResult(body=redactor.redact(body).text, item_count=len(picked))

    def _email_ids(self, scope: str, prog: Progress) -> list[str] | None:
        """unchecked: 키트 기본(아직 받지 않은 항목 전부) / all: 해당 없음만 빼고 전부 / required_only: 받지 않은 필수"""
        ck = kit.checklist()
        if scope == "all":
            return [i for i in self._ids if not ck.is_na(prog, i)]
        if scope == "required_only":
            return [i["id"] for i in self.C["items"] if i["required"] and not ck.is_received(prog, i["id"]) and not ck.is_na(prog, i["id"])]
        return None
