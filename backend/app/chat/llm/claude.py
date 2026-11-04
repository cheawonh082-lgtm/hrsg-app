"""Claude 공급자 (Anthropic Messages API). LLM_PROVIDER=claude 로 선택한다.

- extract: 구조화 출력(output_config.format=json_schema)으로 {intent, gtModelId, condition, economics}를 받는다.
- compose: 공용 시스템 프롬프트(prompts.py) + 토큰 경로 목록 + 인용 발췌. 반환 텍스트는 Orchestrator가 검증한다.
- 외부로 보내는 것은 마스킹된 질문·발췌와 계산 최종값뿐이다(PRD §5). 프롬프트 원문은 LOG_PROMPTS=true일 때만 로그.
"""

import json
import logging

import anthropic

from app.chat.llm.base import ComposeContext, Extraction, LLMProvider, LLMUnavailableError
from app.chat.llm.prompts import EXTRACT_SYSTEM, compose_content, compose_system, extract_content, extract_schema, parse_extraction
from app.domain.models.calc import GasTurbineSpec, Locale

log = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-sonnet-5-5"
# 정책 거절(refusal) 시 서버가 권장 모델로 다시 실행 — 거절 범주별로 자동 선택
_BETAS = ["server-side-fallback-2026-07-01"]


class ClaudeProvider(LLMProvider):
    name = "claude"

    def __init__(self, api_key: str, model: str, log_prompts: bool = False):
        if not api_key:
            raise LLMUnavailableError("LLM_NOT_CONFIGURED", "error.llmNotConfigured")
        self._client = anthropic.Anthropic(api_key=api_key, timeout=60.0, max_retries=2)
        self._model = model or DEFAULT_MODEL
        self._log_prompts = log_prompts

    @property
    def model_label(self) -> str:
        return f"Claude ({self._model})"

    def extract(self, message: str, locale: Locale, gt_models: list[GasTurbineSpec]) -> Extraction:
        response = self._create(
            effort="low",
            max_tokens=4000,
            system=EXTRACT_SYSTEM,
            content=extract_content(message, gt_models),
            output_config_format={"type": "json_schema", "schema": extract_schema(gt_models)},
        )
        text = _text(response)
        if response.stop_reason in ("refusal", "max_tokens") or not text:
            # 판단 보류 — 최종 의도는 규칙 기반 판단(intent.py)이 보완한다
            return Extraction(intent="out_of_scope")
        return parse_extraction(json.loads(text))

    def compose(self, ctx: ComposeContext) -> str:
        response = self._create(
            effort="medium",
            max_tokens=8000,
            system=compose_system(ctx),
            content=compose_content(ctx),
        )
        if response.stop_reason == "refusal":
            return ""
        return _text(response)

    def _create(self, *, effort: str, max_tokens: int, system: str, content: str, output_config_format: dict | None = None):
        output_config: dict = {"effort": effort}
        if output_config_format:
            output_config["format"] = output_config_format
        if self._log_prompts:
            log.info("LLM prompt (%s): %s\n%s", self._model, system, content)
        try:
            response = self._client.beta.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": content}],
                output_config=output_config,
                betas=_BETAS,
                fallbacks="default",
            )
        except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as e:
            raise LLMUnavailableError("LLM_AUTH_FAILED", "error.llmAuth") from e
        except anthropic.NotFoundError as e:
            raise LLMUnavailableError("LLM_MODEL_NOT_FOUND", "error.llmModel") from e
        except anthropic.RateLimitError as e:
            raise LLMUnavailableError("LLM_RATE_LIMITED", "error.llmRateLimited") from e
        except (anthropic.APIConnectionError, anthropic.APIStatusError) as e:
            log.warning("LLM call failed: %s", type(e).__name__)
            raise LLMUnavailableError("LLM_UNAVAILABLE", "error.llmUnavailable") from e
        if response.stop_reason == "refusal":
            log.info("LLM refusal (request %s)", response._request_id)
        return response


def _text(response) -> str:
    return "".join(b.text for b in response.content if b.type == "text").strip()
