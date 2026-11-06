class CalcError(Exception):
    """API 오류 형식(PRD §7.1)으로 변환되는 계산기 도메인 오류."""

    status_code = 422

    def __init__(self, code: str, message_key: str, details: dict | None = None):
        super().__init__(code)
        self.code = code
        self.message_key = message_key
        self.details = details or {}


class UnknownGtModelError(CalcError):
    def __init__(self, model_id: str):
        super().__init__("UNKNOWN_GT_MODEL", "error.unknownGtModel", {"gtModelId": model_id})


class KitInputError(CalcError):
    """키트 validate_inputs()·calculate()가 계산할 수 없다고 한 입력. messages는 키트 문구 그대로."""

    def __init__(self, messages: list[str]):
        super().__init__("CALC_INPUT_INVALID", "error.calcInputInvalid", {"messages": messages})


class CalcResultNotFoundError(CalcError):
    status_code = 404

    def __init__(self, calc_id: str):
        super().__init__("CALC_RESULT_NOT_FOUND", "error.calcResultNotFound", {"calcId": calc_id})
