"""플랜트 데이터 체크리스트 스키마.

항목·분류·상태 키와 문구는 팀 공통 키트(hrsg_calc_kit_team2/data/checklist.json, checklist.py) 그대로다.
키트에 한국어 문구만 있어 영어 화면에서도 항목·분류·메일 문구는 키트 문구를 보여 준다.
진행 상태 저장 형식은 키트와 같다: { "A-01": { "supply": "received", "note": "…" } }.
"""

from typing import Literal

from pydantic import Field

from .base import CamelModel
from .calc import Locale

ChecklistCategory = str  # 키트 categories[].id ('A' ~ 'E')
DataKind = Literal["design", "operation", "document"]
Priority = Literal["required", "recommended", "optional"]  # 키트 priorityLabel(C, item, 'simple'): 필수/권장/선택
PriorityLevel = Literal["high", "medium", "low"]
# 키트 supply 상태 키 — 화면 글자가 아니라 이 키로 저장한다 (verify_needed는 키트 회신 가져오기용, 이 화면에서는 고르지 않음)
ItemStatus = Literal["not_entered", "requested", "received", "verify_needed", "na"]
EmailScope = Literal["unchecked", "all", "required_only"]

MEMO_MAX = 500


class ChecklistItem(CamelModel):
    id: str
    category: ChecklistCategory
    kind: DataKind
    required: bool
    priority: Priority
    priority_level: PriorityLevel
    unit: str | None = None
    calc_input: str | None = None  # 키트 계산기 입력 경로 — 있으면 「계산기 입력에 사용됨」
    linked_calc_field: str | None = None  # 이 앱 계산기 화면 필드(camelCase), 화면에 있는 입력만
    # 키트 문구 그대로
    label: str  # 키트 name
    description: str  # 키트 reason
    detail: str  # 설명 줄 (키트 detail_line: "이유 · 단위 …")


class ChecklistItemState(CamelModel):
    item_id: str
    checked: bool = False  # 키트 is_received (수령 완료 · 검증 필요)
    status: ItemStatus = "not_entered"  # 키트 supply
    memo: str | None = None  # 키트 note


class ChecklistItemPatch(CamelModel):
    """PATCH 본문. 보낸 필드만 바뀐다. 체크 = 'received' (키트: 동그라미 체크 하나만 쓰는 화면)."""

    checked: bool | None = None
    status: Literal["not_entered", "requested", "received", "na"] | None = None
    memo: str | None = Field(None, max_length=MEMO_MAX)


class CategoryProgress(CamelModel):
    total: int
    checked: int


class ChecklistProgress(CamelModel):
    """키트 summary(): 해당 없음(na)은 분모에서 뺀다. 필수는 '수령했고 검증 실패가 아님'."""

    total: int
    checked: int
    required_total: int
    required_checked: int
    percent: int
    by_category: dict[ChecklistCategory, CategoryProgress]


class CategoryInfo(CamelModel):
    id: ChecklistCategory
    label: str


class ChecklistResponse(CamelModel):
    locale: Locale
    categories: list[CategoryInfo]
    items: list[ChecklistItem]
    states: list[ChecklistItemState]
    progress: ChecklistProgress


class EmailExportRequest(CamelModel):
    scope: EmailScope = "unchecked"


class EmailExportResult(CamelModel):
    body: str
    item_count: int
