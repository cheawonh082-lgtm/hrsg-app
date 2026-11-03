"""AI 챗 요청/응답 스키마 (PRD §2.5). 응답은 블록(AnswerBlock) 단위 — 나중에 SSE로 블록별 스트리밍 가능."""

from typing import Annotated, Literal

from pydantic import Field
from pydantic.json_schema import SkipJsonSchema

from .base import CamelModel
from .calc import Locale, Metric, StatusLevel

ChatIntent = Literal["knowledge", "calculation", "mixed", "out_of_scope", "blocked"]


class CalcContext(CamelModel):
    """계산기 화면에서 넘어온 맥락, 또는 ParamConfirmCard에서 사용자가 확인한 값."""

    calc_id: str | None = None
    # Partial<CalcInput>: {gtModelId?, condition?: {...}, economics?: {...}} — 병합 후 CalcInput으로 검증
    input: dict | None = None


class ChatRequest(CamelModel):
    session_id: str
    message: str = Field(..., min_length=1, max_length=2000)
    locale: Locale | None = None  # 미지정 시 입력 언어 자동 감지
    calc_context: CalcContext | None = None


class Citation(CamelModel):
    doc_alias: str  # 'TECH-DOC-017' (원문 파일명·경로 비노출)
    section_title: str | None = None
    snippet: str = Field(..., max_length=300)  # 마스킹된 발췌
    score: float
    # LLM 근거·숫자 검증에만 쓰는 문단 전문 — 응답(JSON)에는 내보내지 않는다
    full_text: SkipJsonSchema[str | None] = Field(default=None, exclude=True)


class Assumption(CamelModel):
    key: str  # camelCase 입력 필드명 (예: hrsgGasDpMbar)
    value: float | str
    unit: str | None = None
    source: Literal["user", "default"]


class TextBlock(CamelModel):
    type: Literal["text"] = "text"
    # 마크다운(소제목·굵게·목록·표). [1], [1,3]은 같은 응답 CitationsBlock.items의 1부터 센 번호
    markdown: str


class CalcResultCard(CamelModel):
    """모든 숫자는 CalcResult에서 서버 코드로 직접 매핑 (G-5, LLM 미경유)."""

    type: Literal["calc_result"] = "calc_result"
    calc_id: str
    is_mock: bool
    headline: list[Metric]
    status: StatusLevel
    assumptions: list[Assumption]
    recommended_method_id: str | None = None


class ParamConfirmCard(CamelModel):
    type: Literal["param_confirm"] = "param_confirm"
    extracted: dict  # Partial<CalcInput>
    missing: list[str]  # 필수인데 없는 필드 (camelCase)
    defaults_proposed: dict[str, float | str]


class CitationsBlock(CamelModel):
    type: Literal["citations"] = "citations"
    items: list[Citation]
    # excerpts: 별칭·절·발췌 / titles: 출처 논문명만 (논문 RAG 검색)
    style: Literal["excerpts", "titles"] = "excerpts"


class FollowUpsBlock(CamelModel):
    """답변 끝의 후속 질문 버튼 — 누르면 그 문장을 새 질문으로 보낸다."""

    type: Literal["follow_ups"] = "follow_ups"
    items: list[str]


class NoticeBlock(CamelModel):
    type: Literal["notice"] = "notice"
    level: Literal["info", "warning"]
    message_key: str


AnswerBlock = Annotated[
    TextBlock | CalcResultCard | ParamConfirmCard | CitationsBlock | NoticeBlock | FollowUpsBlock,
    Field(discriminator="type"),
]


class GuardrailReport(CamelModel):
    number_check: Literal["passed", "sanitized", "not_applicable"]
    redactions: int = 0
    blocked_reason: str | None = None


ProcessStepName = Literal[
    "detect_language", "classify_intent", "retrieve", "extract_params", "calculate", "compose", "validate"
]


class ProcessStep(CamelModel):
    step: ProcessStepName
    status: Literal["running", "done", "skipped", "error"]
    duration_ms: float | None = None


class ChatResponse(CamelModel):
    message_id: str
    intent: ChatIntent
    locale: Locale
    blocks: list[AnswerBlock]
    guardrail: GuardrailReport
    trace: list[ProcessStep] = Field(default_factory=list)
