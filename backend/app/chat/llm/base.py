"""LLM 공급자 인터페이스. 실제 LLM은 이 두 메서드만 구현하면 Orchestrator·가드레일을 그대로 쓴다.

- extract: 질문 → 의도 + 계산 파라미터(구조화 출력). 숫자를 '추정'해서 채우면 안 된다(G-4) — 질문에 있는 값만.
- compose: 근거(계산 최종값·인용) → 서술. 수치는 `{{calc.<path>}}` 토큰으로만 쓴다(G-2).
  토큰 경로는 ComposeContext.calc_values의 키만 허용되며, 그 밖의 숫자는 검증기가 제거한다.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.domain.models.calc import GasTurbineSpec, Locale
from app.domain.models.chat import ChatIntent, Citation


@dataclass(frozen=True)
class Extraction:
    intent: ChatIntent  # LLM 판단. 최종 의도는 규칙 기반 판단과 합쳐서 정한다(chat/intent.py)
    # Partial<CalcInput> (camelCase): {"gtModelId": str, "condition": {...}, "economics": {...}}
    params: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ComposeContext:
    message: str  # 마스킹된 사용자 질문
    locale: Locale
    intent: ChatIntent
    # 토큰 경로(snake_case) → 최종값. 중간 계수·공식 단계는 넣지 않는다(G-7)
    calc_values: dict[str, float] | None = None
    citations: list[Citation] = field(default_factory=list)
    citation_style: str = "excerpts"  # titles: 논문 RAG — 인라인 인용 없이 논리적으로 서술, 출처는 논문명 목록으로 따로 표시
    used_defaults: list[str] = field(default_factory=list)  # 기본값으로 채운 입력 필드(camelCase)


class LLMUnavailableError(Exception):
    """LLM API 호출 실패 — API에서 503으로 바꿔 화면에 안내한다."""

    def __init__(self, code: str, message_key: str):
        super().__init__(code)
        self.code = code
        self.message_key = message_key


class LLMProvider(ABC):
    name: str

    @abstractmethod
    def extract(self, message: str, locale: Locale, gt_models: list[GasTurbineSpec]) -> Extraction: ...

    @abstractmethod
    def compose(self, ctx: ComposeContext) -> str: ...
