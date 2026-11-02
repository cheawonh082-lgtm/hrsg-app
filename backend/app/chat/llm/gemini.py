"""Gemini 공급자 (Google AI Studio, google-genai SDK). LLM_PROVIDER=gemini 로 선택한다.

키 발급: https://aistudio.google.com → Get API key. 루트 .env의 LLM_API_KEY에 넣는다.
- extract: JSON 모드(response_json_schema)로 {intent, gtModelId, condition, economics}를 받는다.
- compose: 공용 시스템 프롬프트(prompts.py) — Claude와 같은 규칙. 반환 텍스트는 Orchestrator가 검증한다.
- 외부로 보내는 것은 마스킹된 질문·발췌와 계산 최종값뿐이다(PRD §5). 프롬프트 원문은 LOG_PROMPTS=true일 때만 로그.
"""

import json
import logging

from google import genai
from google.genai import errors, types

from app.chat.llm.base import ComposeContext, Extraction, LLMProvider, LLMUnavailableError
from app.chat.llm.prompts import EXTRACT_SYSTEM, compose_content, compose_system, extract_content, extract_schema, parse_extraction
from app.domain.models.calc import GasTurbineSpec, Locale

log = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-3.5-flash"
_TIMEOUT_MS = 60_000
# 과부하(503·504)·한도 초과(429)면 다음 모델로 — 무료 등급은 모델마다 한도가 따로라 대체가 효과적
_RETRY_NEXT_MODEL = {429, 503, 504}


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str, log_prompts: bool = False, fallback_models: tuple[str, ...] = ()):
        if not api_key:
            raise LLMUnavailableError("LLM_NOT_CONFIGURED", "error.llmNotConfigured")
        # SDK 자체 재시도는 1회만 — 같은 모델을 오래 기다리기보다 대체 모델로 넘어간다
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=_TIMEOUT_MS, retry_options=types.HttpRetryOptions(attempts=2)),
        )
        self._models = list(dict.fromkeys([model or DEFAULT_MODEL, *fallback_models]))
        self._log_prompts = log_prompts

    def extract(self, message: str, locale: Locale, gt_models: list[GasTurbineSpec]) -> Extraction:
        text = self._generate(
            system=EXTRACT_SYSTEM,
            content=extract_content(message, gt_models),
            response_mime_type="application/json",
            response_json_schema=extract_schema(gt_models),
        )
        if not text:
            # 차단·빈 응답 — 판단 보류, 최종 의도는 규칙 기반 판단(intent.py)이 보완한다
            return Extraction(intent="out_of_scope")
        try:
            return parse_extraction(json.loads(text))
        except json.JSONDecodeError:
            log.warning("Gemini extract returned invalid JSON")
            return Extraction(intent="out_of_scope")

    def compose(self, ctx: ComposeContext) -> str:
        return self._generate(system=compose_system(ctx), content=compose_content(ctx))

    def _generate(self, *, system: str, content: str, **config) -> str:
        if self._log_prompts:
            log.info("LLM prompt (%s): %s\n%s", self._models[0], system, content)
        last: errors.APIError | None = None
        for model in self._models:
            try:
                response = self._client.models.generate_content(
                    model=model,
                    contents=content,
                    config=types.GenerateContentConfig(system_instruction=system, **config),
                )
            except errors.APIError as e:
                if e.code not in _RETRY_NEXT_MODEL:
                    raise _map_error(e) from e
                log.warning("Gemini %s busy (%s), trying next model", model, e.code)
                last = e
                continue
            except OSError as e:  # 연결 실패·타임아웃
                log.warning("LLM connection failed: %s", type(e).__name__)
                raise LLMUnavailableError("LLM_UNAVAILABLE", "error.llmUnavailable") from e
            # 안전 필터로 막히면 text가 None — 서술 없이 카드·인용만 보여 준다
            return (response.text or "").strip()
        raise _map_error(last) from last


def _map_error(e: errors.APIError) -> LLMUnavailableError:
    message = str(e.message).upper()
    # 잘못된 키는 400 INVALID_ARGUMENT("API key not valid")로 온다
    if e.code in (401, 403) or "API KEY" in message or "API_KEY" in message or (e.status or "").upper() == "UNAUTHENTICATED":
        return LLMUnavailableError("LLM_AUTH_FAILED", "error.llmAuth")
    if e.code == 404:
        return LLMUnavailableError("LLM_MODEL_NOT_FOUND", "error.llmModel")
    if e.code == 429:
        return LLMUnavailableError("LLM_RATE_LIMITED", "error.llmRateLimited")
    log.warning("Gemini request failed: %s %s", e.code, e.status)
    return LLMUnavailableError("LLM_UNAVAILABLE", "error.llmUnavailable")
