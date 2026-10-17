"""데이터 요청 이메일 텍스트 (PRD §3.3 예시 형식).

- 범위: unchecked(미완료) / all(전체) / required_only(미완료 필수). '해당 없음(na)'은 어느 범위에도 넣지 않는다.
- 수신자는 정해진 별칭만, 출력 전체에 실명 마스킹을 한 번 더 적용한다(메모에 실명이 들어간 경우, K-04).
"""

from app.checklist.service import Template
from app.domain.models.checklist import ChecklistItem, ChecklistItemState, EmailExportRequest, EmailExportResult
from app.guardrails.redactor import Redactor


def select_items(
    items: list[ChecklistItem], states: list[ChecklistItemState], scope: str
) -> list[tuple[ChecklistItem, ChecklistItemState]]:
    by_id = {s.item_id: s for s in states}
    selected = []
    for item in items:
        state = by_id.get(item.id) or ChecklistItemState(item_id=item.id)
        if state.status == "na":
            continue
        if scope == "unchecked" and state.checked:
            continue
        if scope == "required_only" and (state.checked or item.priority != "required"):
            continue
        selected.append((item, state))
    return selected


def format_email(
    req: EmailExportRequest,
    template: Template,
    items: list[ChecklistItem],
    states: list[ChecklistItemState],
    redactor: Redactor,
) -> EmailExportResult:
    text = template.locale_text(req.locale)
    email = text["email"]
    categories = text["categories"]
    priorities = text["priorities"]
    selected = select_items(items, states, req.scope)

    lines = [email["greeting"].format(recipient=email["recipients"][req.recipient_alias]), email["intro"], ""]
    if not selected:
        lines.append(email["empty"])
    number = 0
    for category in template.categories:
        group = [(i, s) for i, s in selected if i.category == category]
        if not group:
            continue
        lines.append(f"■ {categories[category]}")
        for item, state in group:
            number += 1
            line = f"  {number}. {item.label} [{priorities[item.priority]}]"
            details = [d for d in (item.period, f"{email['unit']}: {item.unit}" if item.unit else None) if d]
            if details:
                line += " — " + ", ".join(details)
            lines.append(line)
            if req.include_memo and state.memo:
                lines.append(f"     ({email['memo']}: {state.memo})")
        lines.append("")
    if lines[-1] != "":
        lines.append("")
    lines.append(email["outro"])

    body = redactor.redact("\n".join(lines)).text
    return EmailExportResult(subject=email["subject"], body=body, item_count=number)
