"""CalcResult → 챗 카드 매핑 (PRD §4.5 G-5). 카드의 숫자는 LLM을 거치지 않고 서버 코드가 직접 채운다."""

from app.domain.models.calc import CalcInput, CalcResult, Metric
from app.domain.models.chat import Assumption, CalcResultCard, ParamConfirmCard

# 입력 필드 접미사(camelCase) → 표시 단위
_UNIT_SUFFIXES = [
    ("Pct", "%"), ("TempC", "℃"), ("Mbar", "mbar"), ("KgS", "kg/s"), ("Barg", "barg"),
    ("KrwPerMwh", "KRW/MWh"), ("KrwPerGj", "KRW/GJ"), ("Hours", "h"), ("Years", "yr"),
]


def unit_for(field: str) -> str | None:
    return next((unit for suffix, unit in _UNIT_SUFFIXES if field.endswith(suffix)), None)


def to_calc_card(result: CalcResult, user_fields: set[str]) -> CalcResultCard:
    """user_fields: 사용자가 직접 준 입력(camelCase 필드명, 'gtModelId' 포함). 나머지는 기본값으로 표시."""
    loss, recovery, current = result.loss, result.recovery, result.current
    recommended = next((m.method_id for m in result.cleaning_comparison if m.recommended), None)
    return CalcResultCard(
        calc_id=result.meta.calc_id,
        is_mock=result.meta.is_mock,
        headline=[
            Metric(key="totalPowerLossMw", value=loss.total_power_loss_mw, unit="MW"),
            Metric(key="annualRevenueLossKrw", value=loss.annual_revenue_loss_krw, unit="KRW"),
            Metric(key="annualRecoveryKrw", value=recovery.annual_recovery_krw, unit="KRW"),
            Metric(key="foulingIndex", value=current.fouling_index, unit="/100", status=current.overall_status),
        ],
        status=current.overall_status,
        assumptions=assumptions(result.input, user_fields),
        recommended_method_id=recommended,
    )


def assumptions(inp: CalcInput, user_fields: set[str]) -> list[Assumption]:
    def source(field: str):
        return "user" if field in user_fields else "default"

    items = [Assumption(key="gtModelId", value=inp.gt_model_id, source=source("gtModelId"))]
    for group in (inp.condition, inp.economics):
        for field, value in group.model_dump(by_alias=True).items():
            if value is not None:
                items.append(Assumption(key=field, value=value, unit=unit_for(field), source=source(field)))
    # 사용자 입력을 앞에 — 카드에서 무엇을 가정했는지 바로 보이도록
    return sorted(items, key=lambda a: a.source != "user")


def to_param_confirm(extracted: dict, missing: list[str], defaults: dict[str, float | str]) -> ParamConfirmCard:
    return ParamConfirmCard(extracted=extracted, missing=missing, defaults_proposed=defaults)
