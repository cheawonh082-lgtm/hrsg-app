"""챗 처리 흐름 (PRD §3.2 시퀀스, §4.5 가드레일).

질문 마스킹 → 입력 필터 → 언어 감지 → 의도 분류 → (계산: 파라미터 병합·계산) / (지식: 검색) → 서술 → 숫자 검증·마스킹.
계산 경로는 Orchestrator가 직접 도구를 호출하므로 '계산 질문인데 도구 미호출'(G-1)이 구조적으로 생기지 않는다.
"""

import copy
import re
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field

from pydantic import ValidationError

from app.calculator.base import CalculatorService
from app.calculator.reference_data.provider import ReferenceDataProvider
from app.calculator.result_cache import CalcResultCache
from app.chat import answer_format, cards, tools
from app.chat.intent import classify
from app.chat.llm.base import ComposeContext, LLMProvider
from app.domain.models.calc import CalcInput, CalcResult, GasTurbineSpec, Locale
from app.domain.models.chat import (
    AnswerBlock,
    CalcContext,
    ChatIntent,
    ChatRequest,
    ChatResponse,
    Citation,
    CitationsBlock,
    FollowUpsBlock,
    GuardrailReport,
    NoticeBlock,
    ProcessStep,
    ProcessStepName,
    TextBlock,
)
from app.guardrails.input_filter import check_input
from app.guardrails.number_validator import check_numbers, numbers_in
from app.guardrails.redactor import Redactor
from app.rag.retriever import Retriever

# 계산에 반드시 사용자가 준 값이 있어야 하는 입력 (G-4: 없으면 추정하지 않고 확인 카드)
REQUIRED_FIELDS = ("gtModelId", "hrsgGasDpMbar", "stackTempC")
_HANGUL = re.compile(r"[가-힣]")
_LATIN = re.compile(r"[A-Za-z]")


@dataclass
class ParamPlan:
    extracted: dict  # 사용자가 준 값(Partial<CalcInput>)
    user_fields: set[str]
    missing: list[str] = field(default_factory=list)
    defaults_proposed: dict[str, float | str] = field(default_factory=dict)
    invalid: bool = False
    input: CalcInput | None = None


class Orchestrator:
    def __init__(
        self,
        llm: LLMProvider,
        calculator: CalculatorService,
        data: ReferenceDataProvider,
        cache: CalcResultCache,
        retriever: Retriever,
        redactor: Redactor,
    ):
        self.llm = llm
        self.calculator = calculator
        self.data = data
        self.cache = cache
        self.retriever = retriever
        self.redactor = redactor

    def handle(self, req: ChatRequest) -> ChatResponse:
        trace = _Trace()
        redacted = self.redactor.redact(req.message)
        message, redactions = redacted.text, redacted.count

        with trace.step("detect_language"):
            locale = req.locale or detect_locale(req.message)

        verdict = check_input(req.message)
        if verdict.verdict != "ok":
            trace.skip("classify_intent", "extract_params", "calculate", "retrieve", "compose", "validate")
            blocked = verdict.verdict == "injection"
            return _response(
                intent="blocked" if blocked else "out_of_scope",
                locale=locale,
                blocks=[NoticeBlock(level="warning", message_key=f"chat.notice.{'blocked' if blocked else 'confidential'}")],
                guardrail=GuardrailReport(number_check="not_applicable", redactions=redactions, blocked_reason=verdict.reason),
                trace=trace,
            )

        gt_models = self.data.list_gt_models()
        ctx = req.calc_context
        with trace.step("classify_intent"):
            extraction = self.llm.extract(message, locale, gt_models)
            intent = classify(extraction.intent, message, has_calc_context=bool(ctx and (ctx.calc_id or ctx.input)))

        head: list[AnswerBlock] = []
        notices: list[AnswerBlock] = []
        result: CalcResult | None = None
        plan: ParamPlan | None = None

        if intent in ("calculation", "mixed"):
            with trace.step("extract_params"):
                plan = self._plan_params(extraction.params, ctx, gt_models, locale)
            if plan.input is None:
                trace.skip("calculate")
                head.append(cards.to_param_confirm(plan.extracted, plan.missing, plan.defaults_proposed))
                key = "chat.notice.invalidParams" if plan.invalid else "chat.notice.paramsNeeded"
                notices.append(NoticeBlock(level="warning" if plan.invalid else "info", message_key=key))
            else:
                with trace.step("calculate"):
                    result = tools.calculate_performance(self.calculator, self.cache, plan.input)
                head.append(cards.to_calc_card(result, plan.user_fields))
        else:
            trace.skip("extract_params", "calculate")

        citations: list[Citation] = []
        if intent in ("knowledge", "mixed"):
            with trace.step("retrieve"):
                citations = tools.search_knowledge(self.retriever, self.redactor, message, locale)
        else:
            trace.skip("retrieve")

        text_blocks: list[AnswerBlock] = []
        follow_ups: list[AnswerBlock] = []
        number_check = "not_applicable"
        # 확인 카드만 필요한 계산 질문, 범위 밖 질문은 서술을 만들지 않는다
        if result is not None or intent in ("knowledge", "mixed"):
            with trace.step("compose"):
                draft = self.llm.compose(
                    ComposeContext(
                        message=message,
                        locale=locale,
                        intent=intent,
                        calc_values=tools.values_for_llm(result) if result else None,
                        citations=citations,
                        citation_style=self.retriever.citation_style,
                        used_defaults=sorted(set(_input_fields(plan.input)) - plan.user_fields) if plan and plan.input else [],
                    )
                )
            with trace.step("validate"):
                # 출처 번호 [n]·굵게(**)는 숫자·수식 검사 대상이 아니다 — 자리표시로 보호했다가 되돌린다
                protected = answer_format.protect(draft, len(citations))
                checked = check_numbers(
                    protected.text,
                    locale,
                    result=result,
                    allowed_literals=grounded_numbers(message, citations),
                    allowed_paths=tools.LLM_VISIBLE_PATHS,
                )
                number_check = checked.status
                if checked.formula_blocked:
                    notices.append(NoticeBlock(level="warning", message_key="chat.notice.confidential"))
                elif checked.text.strip():
                    out = self.redactor.redact(checked.text)
                    redactions += out.count
                    body, questions = answer_format.split_followups(answer_format.restore(out.text, protected))
                    if body:
                        # [AI]: 자료에 근거가 없어 일반 지식으로 보충한 부분 — 어떤 모델이 썼는지 출처로 남긴다
                        ai_model = self.llm.model_label if answer_format.AI_MARK in body else None
                        text_blocks.append(TextBlock(markdown=body, ai_model=ai_model))
                    if questions:
                        follow_ups.append(FollowUpsBlock(items=[answer_format.CITE_RE.sub("", q).strip() for q in questions]))
                if checked.status == "sanitized" and not checked.formula_blocked:
                    notices.append(NoticeBlock(level="info", message_key="chat.notice.sanitized"))
        else:
            trace.skip("compose", "validate")
            if intent == "out_of_scope":
                notices.append(NoticeBlock(level="info", message_key="chat.notice.outOfScope"))

        blocks: list[AnswerBlock] = [*head, *text_blocks]
        if citations:
            blocks.append(CitationsBlock(items=citations, style=self.retriever.citation_style))
        blocks.extend(notices)
        blocks.extend(follow_ups)
        return _response(
            intent=intent,
            locale=locale,
            blocks=blocks,
            guardrail=GuardrailReport(number_check=number_check, redactions=redactions),
            trace=trace,
        )

    # ---- 파라미터 병합 ----
    def _plan_params(
        self, extracted: dict, ctx: CalcContext | None, gt_models: list[GasTurbineSpec], locale: Locale
    ) -> ParamPlan:
        """우선순위: 모델 기본값 < 계산기 결과(calcId) < 질문에서 추출한 값 < calcContext.input.

        calcContext.input은 사용자가 확인 카드·가정 수정에서 직접 확정한 값이라 가장 우선한다
        (같은 질문을 재전송하므로, 질문 문장에서 다시 뽑은 값이 수정값을 덮으면 안 된다).
        """
        base: dict | None = None
        user: dict = {}
        if ctx and ctx.calc_id:
            cached = self.cache.get(ctx.calc_id)
            if cached:
                base = cached.input.model_dump(by_alias=True)
                user = _prune_none(copy.deepcopy(base))
        user = _deep_merge(user, extracted)
        if ctx and ctx.input:
            user = _deep_merge(user, _prune_none(ctx.input))
        user.pop("locale", None)

        model_id = user.get("gtModelId")
        if model_id and not any(m.model_id == model_id for m in gt_models):
            user.pop("gtModelId")  # 모르는 모델은 사용자에게 다시 고르게 한다
            model_id = None
        user_fields = set(_input_fields(user))
        defaults = self._defaults(model_id or gt_models[0].model_id, locale)
        default_fields = dict(_flatten(defaults))

        missing = [f for f in REQUIRED_FIELDS if f not in user_fields]
        if missing:
            return ParamPlan(user, user_fields, missing, {f: default_fields[f] for f in missing if f in default_fields})

        start = base if base and base["gtModelId"] == model_id else defaults
        merged = _deep_merge(copy.deepcopy(start), user)
        merged["locale"] = locale
        try:
            inp = CalcInput.model_validate(merged)
        except ValidationError as e:
            bad = sorted({str(err["loc"][-1]) for err in e.errors()})
            return ParamPlan(user, user_fields, bad, {f: default_fields[f] for f in bad if f in default_fields}, invalid=True)
        return ParamPlan(user, user_fields, input=inp)

    def _defaults(self, model_id: str, locale: Locale) -> dict:
        return self.data.default_input(model_id, "example", locale).model_dump(by_alias=True)


def grounded_numbers(message: str, citations: list[Citation]) -> set[float]:
    """답변에 그대로 써도 되는 숫자: 사용자 질문과, LLM에게 보낸 출처의 본문·논문 제목·절 제목에 있는 숫자.
    제목도 프롬프트에 들어가므로("500MW PLANT-X …") 여기서 빠지면 맞는 숫자가 '(계산 결과 카드 참조)'로 바뀐다.
    발행처(venue)는 프롬프트에 없으므로 넣지 않는다."""
    texts = [message]
    for c in citations:
        texts += [c.full_text or c.snippet, c.title, c.section_title or ""]
    return numbers_in(texts)


def detect_locale(text: str) -> Locale:
    if _HANGUL.search(text):
        return "ko"
    return "en" if _LATIN.search(text) else "ko"


# ---- 도우미 ----
class _Trace:
    def __init__(self) -> None:
        self.steps: list[ProcessStep] = []

    @contextmanager
    def step(self, name: ProcessStepName):
        start = time.perf_counter()
        status = "done"
        try:
            yield
        except Exception:
            status = "error"
            raise
        finally:
            ms = round((time.perf_counter() - start) * 1000, 2)
            self.steps.append(ProcessStep(step=name, status=status, duration_ms=ms))

    def skip(self, *names: ProcessStepName) -> None:
        self.steps.extend(ProcessStep(step=n, status="skipped") for n in names)


def _response(
    *, intent: ChatIntent, locale: Locale, blocks: list[AnswerBlock], guardrail: GuardrailReport, trace: _Trace
) -> ChatResponse:
    return ChatResponse(
        message_id=str(uuid.uuid4()), intent=intent, locale=locale, blocks=blocks, guardrail=guardrail, trace=trace.steps
    )


def _flatten(partial: dict) -> list[tuple[str, object]]:
    """Partial<CalcInput> → [(필드명, 값)]. 그룹(condition/economics)은 펼친다."""
    items: list[tuple[str, object]] = []
    for key, value in partial.items():
        if isinstance(value, dict):
            items.extend((k, v) for k, v in value.items() if v is not None)
        elif value is not None and key != "locale":
            items.append((key, value))
    return items


def _input_fields(partial: dict | CalcInput) -> list[str]:
    if isinstance(partial, CalcInput):
        partial = partial.model_dump(by_alias=True)
    return [k for k, _ in _flatten(partial)]


def _prune_none(d: dict) -> dict:
    return {k: _prune_none(v) if isinstance(v, dict) else v for k, v in d.items() if v is not None}


def _deep_merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in over.items():
        out[k] = _deep_merge(out.get(k) or {}, v) if isinstance(v, dict) else v
    return out
