"""어댑터: 이 앱의 계산기 화면 입력(CalcInput) ↔ 키트 입력(inp). 키트 README 「팀 2 화면 연결표」.

키트 규칙에 따라 이름·단위 차이는 여기에서만 바꾼다.
- 키트 입력은 default_inputs(D, 등급)에서 시작하고, 화면에 있는 값만 덮어쓴다.
  화면에 없는 키트 입력(세정 공법 4개, 목표 회수 출력, IP·LP 섹션)은 키트 데이터 값 그대로다.
- 압력은 키 이름의 단위로 넣는다(gt_bp_mbar · hrsg_dp_mbar). 직접 단위를 변환하지 않는다.
- 전력 단가는 화면이 원/MWh 이므로 키트의 price_krw_per_mwh 로 넣고, 키트 기본값(price_krw_per_kwh)은 뺀다.
"""

from typing import Literal

from app import kit
from app.calculator.errors import UnknownGtModelError
from app.domain.models.calc import CalcInput, EconomicParams, GasTurbineSpec, Locale, OperatingCondition

Preset = Literal["example", "design"]

# 화면 HP 고급 입력 ↔ 키트 sections.HP
_HP_FIELDS = {
    "hp_drum_pressure_barg": "drum_barg",
    "hp_evap_gas_out_temp_c": "evap_outlet_gas_c",
    "hp_eco_water_out_temp_c": "econ_outlet_water_c",
}

# 키트 체크리스트 calc_input(키트 입력 경로) → 이 앱 계산기 입력 필드(camelCase). 화면에 없는 입력은 넣지 않는다.
CHECKLIST_FIELD = {
    "equipment.gt_class": "gtModelId",
    "equipment.gt_bp": "gtBackPressureMbar",
    "equipment.hrsg_dp": "hrsgGasDpMbar",
    "equipment.stack_c": "stackTempC",
    "equipment.load_pct": "gtLoadPct",
    "equipment.ambient_c": "ambientTempC",
    "equipment.gt_exhaust_c": "exhaustTempC",
    "equipment.exhaust_flow_kgs": "exhaustFlowKgS",
    "sections.HP.drum_barg": "hpDrumPressureBarg",
    "sections.HP.evap_outlet_gas_c": "hpEvapGasOutTempC",
    "sections.HP.econ_outlet_water_c": "hpEcoWaterOutTempC",
    "hp_steam_tph": "hpSteamTph",
    "economics.price": "electricityPriceKrwPerMwh",
    "economics.monthly_hours": "monthlyOperatingHours",
    "economics.annual_hours": "annualOperatingHours",
}


def model_id(class_id: str) -> str:
    return f"GT_MOCK_{class_id}_CLASS"


def gt_class(model_id_: str, D: dict) -> dict:
    for g in D["gt_classes"]:
        if model_id(g["id"]) == model_id_:
            return g
    raise UnknownGtModelError(model_id_)


def gt_spec(g: dict) -> GasTurbineSpec:
    return GasTurbineSpec(
        model_id=model_id(g["id"]),
        display_name=g["name"],
        rated_power_mw=g["rated_gt_mw"],
        rated_st_mw=g["rated_st_mw"],
        rated_exhaust_flow_kg_s=g["operation"]["exhaust_flow_kgs"],
        rated_exhaust_temp_c=g["operation"]["gt_exhaust_c"],
    )


def to_kit_input(inp: CalcInput, D: dict) -> dict:
    """화면 입력 → 키트 inp (validate_inputs 의 오류·경고가 0개인 모양)"""
    calc = kit.calc()
    cls = gt_class(inp.gt_model_id, D)
    k = calc.default_inputs(D, {"gt_class": cls["id"]})
    c, e = inp.condition, inp.economics
    k["equipment"].update(
        load_pct=c.gt_load_pct,
        gt_bp_mbar=c.gt_back_pressure_mbar,
        hrsg_dp_mbar=c.hrsg_gas_dp_mbar,
        stack_c=c.stack_temp_c,
        gt_exhaust_c=c.exhaust_temp_c,
        exhaust_flow_kgs=c.exhaust_flow_kg_s,
        ambient_c=c.ambient_temp_c,
    )
    economics = {k_: v for k_, v in k["economics"].items() if k_ not in ("price_krw_per_kwh", "price_krw_per_mwh")}
    k["economics"] = {
        **economics,
        "price_krw_per_mwh": e.electricity_price_krw_per_mwh,
        "monthly_hours": e.monthly_operating_hours,
        "annual_hours": e.annual_operating_hours,
    }
    hp = {kit_key: getattr(c, field) for field, kit_key in _HP_FIELDS.items() if getattr(c, field) is not None}
    k["sections"] = {**k["sections"], "HP": hp or None}
    k["hp_steam_tph"] = c.hp_steam_tph
    return k


def from_kit_input(k: dict, D: dict, locale: Locale = "ko") -> CalcInput:
    """키트 inp → 화면 입력 (「기본값」·「초기화」를 화면에 채울 때)"""
    eq, ec = k["equipment"], k["economics"]
    hp = (k.get("sections") or {}).get("HP") or {}
    price = ec.get("price_krw_per_mwh")
    if price is None:
        price = ec["price_krw_per_kwh"] * 1000  # 키트 기본 SMP(원/kWh) → 화면 단위(원/MWh)
    monthly, annual = ec.get("monthly_hours"), ec.get("annual_hours")
    if annual is None:
        annual = monthly * 12
    if monthly is None:
        monthly = annual / 12  # 키트: 하나만 있으면 ×12 / ÷12
    return CalcInput(
        gt_model_id=model_id(eq["gt_class"]),
        condition=OperatingCondition(
            gt_load_pct=eq["load_pct"],
            ambient_temp_c=eq["ambient_c"],
            exhaust_temp_c=eq["gt_exhaust_c"],
            exhaust_flow_kg_s=eq["exhaust_flow_kgs"],
            gt_back_pressure_mbar=eq["gt_bp_mbar"],
            hrsg_gas_dp_mbar=eq["hrsg_dp_mbar"],
            stack_temp_c=eq["stack_c"],
            hp_steam_tph=k.get("hp_steam_tph"),
            **{field: hp.get(kit_key) for field, kit_key in _HP_FIELDS.items()},
        ),
        economics=EconomicParams(
            electricity_price_krw_per_mwh=price,
            monthly_operating_hours=round(monthly),
            annual_operating_hours=round(annual),
        ),
        locale=locale,
    )


def preset_input(model_id_: str, preset: Preset, D: dict, locale: Locale = "ko") -> CalcInput:
    """example: 키트 defaultInputs(D) (예시 운전 상태) / design: designInputs(D, 등급) (설계 상태, 손실 0)"""
    calc = kit.calc()
    cls = gt_class(model_id_, D)
    k = calc.design_inputs(D, cls["id"]) if preset == "design" else calc.default_inputs(D, {"gt_class": cls["id"]})
    return from_kit_input(k, D, locale)
