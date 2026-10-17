"""입력 범위(min/max)를 Pydantic 스키마에서 추출 — 프론트 zod 검증이 백엔드와 같은 범위를 쓰도록 한다."""

from pydantic import BaseModel

from .base import CamelModel
from .calc import EconomicParams, OperatingCondition


class FieldLimit(CamelModel):
    min: float | None = None
    max: float | None = None
    exclusive_min: bool = False
    exclusive_max: bool = False
    integer: bool = False
    nullable: bool = False  # true면 비워 둘 수 있음


class InputLimits(CamelModel):
    condition: dict[str, FieldLimit]  # 키는 camelCase 필드명
    economics: dict[str, FieldLimit]


def _field_limits(model: type[BaseModel]) -> dict[str, FieldLimit]:
    limits = {}
    for name, prop in model.model_json_schema(by_alias=True)["properties"].items():
        branches = prop.get("anyOf", [prop])
        number = next((b for b in branches if b.get("type") in ("number", "integer")), None)
        if number is None:
            continue
        limits[name] = FieldLimit(
            min=number.get("minimum", number.get("exclusiveMinimum")),
            max=number.get("maximum", number.get("exclusiveMaximum")),
            exclusive_min="exclusiveMinimum" in number,
            exclusive_max="exclusiveMaximum" in number,
            integer=number["type"] == "integer",
            nullable=any(b.get("type") == "null" for b in branches),
        )
    return limits


def input_limits() -> InputLimits:
    return InputLimits(condition=_field_limits(OperatingCondition), economics=_field_limits(EconomicParams))
