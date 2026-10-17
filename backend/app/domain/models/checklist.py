"""플랜트 데이터 체크리스트 스키마 (PRD §2.4).

항목 문구는 서버 템플릿(app/checklist/templates)에서 로케일별로 풀어서 보낸다(label·description·period).
labelKey는 PRD 호환용으로 함께 둔다.
"""

from datetime import datetime
from typing import Literal

from pydantic import Field

from .base import CamelModel
from .calc import Locale

ChecklistCategory = Literal[
    "gas_turbine", "exhaust_gas", "feedwater_steam", "pinch_approach",
    "design_docs", "maintenance_history", "economics",
]
DataKind = Literal["design", "operating", "document"]
Priority = Literal["required", "recommended", "optional"]
ItemStatus = Literal["pending", "requested", "received", "na"]
EmailScope = Literal["unchecked", "all", "required_only"]
RecipientAlias = Literal["customer_contact", "plant_operations", "performance_engineer"]

MEMO_MAX = 500


class ChecklistItem(CamelModel):
    id: str
    category: ChecklistCategory
    label_key: str
    kind: DataKind
    priority: Priority
    unit: str | None = None
    linked_calc_field: str | None = None  # 계산기 입력 필드(camelCase)
    # 로케일별 문구
    label: str
    description: str | None = None
    period: str | None = None


class ChecklistItemState(CamelModel):
    item_id: str
    checked: bool = False
    status: ItemStatus = "pending"
    memo: str | None = None
    updated_at: datetime | None = None


class ChecklistItemPatch(CamelModel):
    """PATCH 본문: Partial<ChecklistItemState>. 보낸 필드만 바뀐다."""

    checked: bool | None = None
    status: ItemStatus | None = None
    memo: str | None = Field(None, max_length=MEMO_MAX)


class CategoryProgress(CamelModel):
    total: int
    checked: int


class ChecklistProgress(CamelModel):
    """'해당 없음(na)' 항목은 분모·분자 모두에서 뺀다."""

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
    locale: Locale = "ko"
    scope: EmailScope = "unchecked"
    # 실명 대신 정해진 별칭만 (PRD §5). 자유 입력란은 두지 않는다
    recipient_alias: RecipientAlias = "customer_contact"
    include_memo: bool = False


class EmailExportResult(CamelModel):
    subject: str
    body: str
    item_count: int
