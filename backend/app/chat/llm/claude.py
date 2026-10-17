"""Claude 공급자 — 연결 예정 (PRD §7.4 #5: 외부 LLM API 허용 여부 확정 후).

`.env`에서 LLM_PROVIDER=claude 로 바꾸면 이 클래스가 선택된다. 구현 전에는 /api/chat이 501을 반환한다.

구현 가이드:
- extract: Messages API 구조화 출력(tool use)으로 {intent, params}를 받는다.
  params 스키마는 CalcInput.model_json_schema(by_alias=True)에서 required를 뺀 부분 스키마.
- compose: 시스템 프롬프트(PRD §4.5 핵심 규칙) + ctx.calc_values의 토큰 경로 목록 + 인용 발췌(구분자로 격리)를 넣고,
  "수치는 {{calc.<path>}} 토큰으로만" 지시. 반환 텍스트는 Orchestrator가 number_validator로 검증한다.
- 외부 전송 데이터는 마스킹된 질문·발췌와 계산 최종값뿐이다(PRD §5). LOG_PROMPTS=false가 기본.
"""

from app.chat.llm.base import ComposeContext, Extraction, LLMProvider
from app.domain.models.calc import GasTurbineSpec, Locale


class ClaudeProvider(LLMProvider):
    name = "claude"

    def __init__(self, api_key: str, model: str):
        self._api_key = api_key
        self._model = model

    def extract(self, message: str, locale: Locale, gt_models: list[GasTurbineSpec]) -> Extraction:
        raise NotImplementedError("ClaudeProvider.extract")

    def compose(self, ctx: ComposeContext) -> str:
        raise NotImplementedError("ClaudeProvider.compose")
