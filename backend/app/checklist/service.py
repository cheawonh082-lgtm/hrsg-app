"""체크리스트 템플릿 로드·상태 병합·진행률 계산."""

from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path

import yaml

from app.calculator.errors import CalcError
from app.checklist.store import ChecklistStateStore
from app.domain.models.calc import Locale
from app.domain.models.checklist import (
    CategoryInfo,
    CategoryProgress,
    ChecklistItem,
    ChecklistItemPatch,
    ChecklistItemState,
    ChecklistProgress,
    ChecklistResponse,
)

TEMPLATE_DIR = Path(__file__).with_name("templates")


class UnknownChecklistItemError(CalcError):
    status_code = 404

    def __init__(self, item_id: str):
        super().__init__("UNKNOWN_CHECKLIST_ITEM", "error.unknownChecklistItem", {"itemId": item_id})


@dataclass(frozen=True)
class Template:
    categories: list[str]
    items: list[dict]  # items.yaml 원본 (snake_case 키)
    text: dict[str, dict]  # 로케일 → default_{locale}.yaml

    def locale_text(self, locale: Locale) -> dict:
        return self.text[locale]


@lru_cache
def load_template(template_dir: Path = TEMPLATE_DIR) -> Template:
    structure = yaml.safe_load((template_dir / "items.yaml").read_text(encoding="utf-8"))
    text = {
        locale: yaml.safe_load((template_dir / f"default_{locale}.yaml").read_text(encoding="utf-8"))
        for locale in ("ko", "en")
    }
    ids = {i["id"] for i in structure["items"]}
    for locale, t in text.items():
        missing = ids - set(t["items"])
        if missing:
            raise ValueError(f"default_{locale}.yaml에 문구가 없는 항목: {sorted(missing)}")
    return Template(structure["categories"], structure["items"], text)


class ChecklistService:
    def __init__(self, template: Template, store: ChecklistStateStore):
        self.template = template
        self.store = store
        self._ids = [i["id"] for i in template.items]

    def items(self, locale: Locale) -> list[ChecklistItem]:
        text = self.template.locale_text(locale)["items"]
        return [
            ChecklistItem(
                id=i["id"],
                category=i["category"],
                label_key=f"checklist.items.{i['id']}",
                kind=i["kind"],
                priority=i["priority"],
                unit=i.get("unit"),
                linked_calc_field=i.get("linked_calc_field"),
                label=text[i["id"]]["label"],
                description=text[i["id"]].get("description"),
                period=text[i["id"]].get("period"),
            )
            for i in self.template.items
        ]

    def states(self) -> list[ChecklistItemState]:
        saved = self.store.load()
        return [saved.get(item_id) or ChecklistItemState(item_id=item_id) for item_id in self._ids]

    def get(self, locale: Locale) -> ChecklistResponse:
        names = self.template.locale_text(locale)["categories"]
        items = self.items(locale)
        states = self.states()
        return ChecklistResponse(
            locale=locale,
            categories=[CategoryInfo(id=c, label=names[c]) for c in self.template.categories],
            items=items,
            states=states,
            progress=compute_progress(items, states, self.template.categories),
        )

    def patch(self, item_id: str, patch: ChecklistItemPatch) -> ChecklistItemState:
        if item_id not in self._ids:
            raise UnknownChecklistItemError(item_id)
        current = self.store.load().get(item_id) or ChecklistItemState(item_id=item_id)
        changes = patch.model_dump(exclude_unset=True)
        if "memo" in changes and changes["memo"] is not None:
            changes["memo"] = changes["memo"].strip() or None
        updated = current.model_copy(update={**changes, "updated_at": datetime.now(UTC)})
        self.store.save(updated)
        return updated

    def reset(self) -> None:
        self.store.clear()


def compute_progress(
    items: list[ChecklistItem], states: list[ChecklistItemState], categories: list[str]
) -> ChecklistProgress:
    """'해당 없음(na)'은 분모·분자에서 뺀다. 프론트 lib/checklist.ts의 computeProgress와 같은 규칙."""
    by_id = {s.item_id: s for s in states}
    by_category = {c: CategoryProgress(total=0, checked=0) for c in categories}
    total = checked = required_total = required_checked = 0
    for item in items:
        state = by_id.get(item.id) or ChecklistItemState(item_id=item.id)
        if state.status == "na":
            continue
        done = state.checked
        total += 1
        checked += done
        by_category[item.category].total += 1
        by_category[item.category].checked += done
        if item.priority == "required":
            required_total += 1
            required_checked += done
    return ChecklistProgress(
        total=total,
        checked=checked,
        required_total=required_total,
        required_checked=required_checked,
        percent=round(checked / total * 100) if total else 0,
        by_category=by_category,
    )
