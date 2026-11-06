"""팀 공통 계산기·체크리스트 키트(hrsg_calc_kit_team2) 불러오기.

키트 README·CLAUDE.md 규칙: 코어(calc.py · checklist.py · data/)는 고치지 않고 그대로 쓴다.
이 앱의 이름·단위 차이는 어댑터(app.calculator.kit_adapter, app.checklist.service)에서만 바꾼다.

키트 파일 이름(calc, checklist)이 흔한 이름이라 sys.path에 넣지 않고 경로로 모듈을 만든다.
"""

import importlib.util
import sys
from functools import lru_cache
from pathlib import Path
from types import ModuleType

from app.config import get_settings


def _load(name: str, path: Path) -> ModuleType:
    if not path.is_file():
        raise FileNotFoundError(f"계산기 키트 파일이 없습니다: {path} (CALC_KIT_DIR 확인)")
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    # 키트 폴더에 __pycache__ 를 만들지 않는다 (키트 폴더 구조는 바꾸지 않는다)
    before, sys.dont_write_bytecode = sys.dont_write_bytecode, True
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = before
    return module


@lru_cache
def kit_dir() -> Path:
    return get_settings().calc_kit_dir


@lru_cache
def calc() -> ModuleType:
    """키트 calc.py (calculate · compare_methods · key_indicators · efficiency_trend · loss_curve …)"""
    return _load("hrsg_kit_calc", kit_dir() / "calc.py")


@lru_cache
def checklist() -> ModuleType:
    """키트 checklist.py (summary · filter_items · email_draft · validate_progress …)"""
    return _load("hrsg_kit_checklist", kit_dir() / "checklist.py")


@lru_cache
def calculator_data() -> dict:
    """키트 data/calculator.json (= 키트 문서의 D). 호출한 쪽에서 고치지 않는다."""
    return calc().load_calculator_data(kit_dir() / "data" / "calculator.json")


@lru_cache
def checklist_data() -> dict:
    """키트 data/checklist.json (= 키트 문서의 C)"""
    return checklist().load_checklist_data(kit_dir() / "data" / "checklist.json")
