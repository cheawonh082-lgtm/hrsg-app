# HRSG 레퍼런스 앱 (PoC)

복합화력 발전소 엔지니어를 위한 AI 질의응답 + 성능·경제성 계산기 + 플랜트 데이터 체크리스트 웹 앱.
제품·기술 명세는 [PRD.md](PRD.md) 참조.

> ⚠ 현재 계산 엔진과 레퍼런스 데이터는 모두 **Mock(가상 값)** 입니다. 화면의 수치는 검증되지 않았습니다.
> AI 질의응답도 **Fake LLM(규칙 기반 예시 응답)** 과 **가상 예시 문서**로 동작합니다 — 아래 "실제 LLM 연결", "실제 문서 넣기" 참조.

## 구성

| 경로 | 내용 |
|---|---|
| `backend/` | FastAPI + Pydantic v2. 계산기 인터페이스(`app/calculator/base.py`)와 Mock 구현 |
| `backend/app/chat/` | AI 챗: Orchestrator, LLM 인터페이스(`llm/base.py`) + Fake/Claude(stub) 구현 |
| `backend/app/rag/` | 문서 검색: `Retriever` 인터페이스 + 키워드 검색, 인제스트 CLI, 가상 예시 문서(`mock_docs/`) |
| `backend/app/guardrails/` | 입력 필터(인젝션·공식 요청), 숫자 출처 검증, 실명 마스킹 |
| `backend/app/checklist/` | 플랜트 데이터 체크리스트: 항목 템플릿(`templates/*.yaml`), 상태 저장, 이메일 포맷터 |
| `frontend/` | Vite + React 18 + TypeScript + Tailwind v4. 반응형 AppShell |
| `tests/backend/` | 계산기 계약·챗 시나리오·가드레일·체크리스트 API 테스트 (pytest) |
| `frontend/src/**/*.test.ts(x)` | 단위 테스트 (Vitest + Testing Library): 카드·진행률 계산·이메일 다이얼로그·키보드 보정 등 |
| `frontend/e2e/` | E2E (Playwright): 계산기·챗·체크리스트 시나리오, 반응형 교차 검수(`responsive.spec.ts`, `responsive/layout.spec.ts`) |

## 실행

필요: Python 3.11+, Node 20+, Chrome(E2E용)

```bash
# 1) 환경변수
cp .env.example .env

# 2) 백엔드 — http://127.0.0.1:8000/docs
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -e . --group dev      # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
#   uv 사용 시: uv sync && uv run uvicorn app.main:app --reload --port 8000

# 3) 프론트엔드 — http://localhost:5173  (/api 요청은 dev 서버가 8000번으로 프록시)
cd frontend
npm install
npm run gen:api     # 백엔드 실행 중일 때, 스키마 변경 시마다
npm run dev
```

## 배포 (Render 무료 플랜)

`render.yaml`(Blueprint) — 절차와 무료 플랜 제약은 [DEPLOY.md](DEPLOY.md).

## 테스트

```bash
cd backend && .venv/Scripts/python -m pytest          # 백엔드 테스트 (계산기·챗·체크리스트)
cd frontend && npm test                                # 단위 테스트 (Vitest)
cd frontend && npm run build                           # 타입 검사 + 빌드
cd frontend && npm run test:e2e                        # 전체 E2E (서버 미실행 시 자동 기동, 약 3분)
cd frontend && npx playwright test e2e/checklist.spec.ts   # 파일 하나만
```

- E2E는 실제 백엔드를 띄워 실행하며, 체크리스트 테스트는 시작할 때마다 체크 상태를 초기화합니다(`POST /api/checklist/reset`). 개발 중 체크해 둔 내용이 있으면 지워집니다.
- `responsive.spec.ts`는 360·390·768·1280px × 3개 화면 × (한국어·라이트 / 영어·다크)에서 가로 넘침, 버튼·KPI 글자 넘침, 상태 색 대비를 검사하고, 화면마다 전체 페이지 스크린샷을 `frontend/test-results/`에 남깁니다(픽셀 비교는 하지 않음).

## 실제 계산 공식 적용

`.env`의 `CALC_ENGINE=real`로 바꾸면 `RealCalculator`가 사용됩니다(현재는 501 응답).
교체 절차는 PRD §4.4 참조 — 공식·실측 데이터는 `secrets/`(Git 미추적)에만 둡니다.

## 실제 LLM 연결 (Gemini / Claude)

기본은 `LLM_PROVIDER=fake` — 정규식으로 파라미터를 뽑고 고정 템플릿으로 답하는 결정적 구현입니다. 테스트는 로컬 `.env`와 관계없이 항상 Fake로 실행됩니다(`tests/backend/conftest.py`).
두 공급자는 같은 프롬프트·스키마(`backend/app/chat/llm/prompts.py`)를 쓰고, 키만 바꿔 넣으면 됩니다.

| 공급자 | 구현 | 키 발급 | 기본 모델 |
|---|---|---|---|
| `gemini` | `app/chat/llm/gemini.py` | [Google AI Studio](https://aistudio.google.com) → Get API key | `gemini-3.5-flash` |
| `claude` | `app/chat/llm/claude.py` | [Claude Console](https://platform.claude.com) → API Keys | `claude-sonnet-5-5` |

루트 `.env`(Git 제외)를 수정하고 백엔드를 재시작합니다. `/api/health`의 `llm`이 바뀌고 챗 화면의 "Fake" 안내가 사라집니다.
```
LLM_PROVIDER=gemini
LLM_API_KEY=...
LLM_MODEL=gemini-3.5-flash-lite
LLM_FALLBACK_MODELS=gemini-3.5-flash,gemini-3.8-flash   # gemini 전용
```

동작 방식
- 질문 1건당 API 호출 2회: `extract`(의도·파라미터, JSON 스키마 출력)와 `compose`(서술). 확인 카드만 필요한 질문·범위 밖 질문은 `compose`를 호출하지 않습니다.
- 서술의 수치는 `{{calc.<path>}}` 토큰으로만 쓰게 하고, 토큰 밖 숫자는 검증기가 제거합니다(PRD §4.5 G-2·G-3). 계산·카드·마스킹은 Orchestrator가 처리합니다.
- 외부로 보내는 것은 마스킹된 질문·문서 발췌와 계산 최종값뿐입니다(PRD §5). `LOG_PROMPTS=true`일 때만 프롬프트를 로그에 남깁니다.
- Gemini: 모델이 과부하(503·504)이거나 한도 초과(429)면 `LLM_FALLBACK_MODELS`의 모델을 차례로 시도합니다. 안전 필터로 막히면 서술 없이 카드·인용만 보여 줍니다.
- Claude: 정책상 거절되면 서버 측 대체 모델(`fallbacks: "default"`)로 다시 시도합니다.
- 키 오류·한도 초과·네트워크 오류는 503(`LLM_AUTH_FAILED`, `LLM_RATE_LIMITED`, `LLM_UNAVAILABLE` 등)으로 돌려주고 챗 화면에 원인을 표시합니다.

> **Gemini 무료 등급 한도**: 모델·프로젝트별 하루 요청 수가 작습니다(예: `gemini-3.5-flash` 하루 20회 = 질문 약 10건). 실사용·시연 전에는 AI Studio에서 결제(유료 등급)를 등록하세요.

다른 공급자(로컬 모델 등)는 `LLMProvider`를 상속한 클래스를 추가하고 `app/chat/registry.py`의 `get_llm`에 분기를 넣습니다.

## 실제 문서 넣기

지금은 `backend/app/rag/mock_docs/`의 가상 문서(한/영 7개)를 검색합니다. 화면에는 "예시 문서" 배지와 개발 모드 안내가 표시됩니다.

1. 원문(.md, .txt / UTF-8)을 `data/docs_raw/`에 넣습니다. PDF·DOCX는 텍스트로 변환해서 넣습니다.
   - 선택: 맨 위에 front matter(`title`, `lang`)를 넣고, 본문은 `## 섹션` 단위로 나누면 인용이 섹션 단위로 나옵니다.
2. 실명 마스킹 사전을 `secrets/redaction_dict.yaml`에 둡니다(형식은 `backend/app/guardrails/mock_redaction_dict.yaml` 참조). 없으면 가상 사전 + 패턴(`○○발전소`, `N호기`)만 적용됩니다.
3. 인제스트: `cd backend && .venv/Scripts/python -m app.rag.ingest` (먼저 `--dry-run`으로 마스킹 횟수 확인 권장)
   - 결과는 `data/docs_masked/TECH-DOC-###.md`로 저장되고, 원문 파일명은 별칭으로 바뀝니다(대응표는 `data/docs_raw/.aliases.json`).
4. 서버를 재시작하면 `data/docs_masked/`의 문서로 자동 전환됩니다(`/api/health`의 `docs`가 `real`로 바뀜).

`data/docs_raw/`, `data/docs_masked/`, `secrets/`는 Git에 올라가지 않습니다. 검색 품질이 부족하면 `Retriever`를 구현한 임베딩 검색을 추가하고 `RAG_RETRIEVER`로 고릅니다.

### 논문 RAG 검색 API 연결 (`RAG_RETRIEVER=api`)

참고 논문 41편(3,095문단)을 검색하는 별도 서버(`hrsg-explorer-rag`, bge-m3 · Qwen3-Embedding · BM25 하이브리드)를 근거로 답합니다.

1. RAG 서버 실행: `cd ../hrsg-explorer-rag && .venv/Scripts/python -m uvicorn api.app:app --port 8100` (인덱스 구축은 그 저장소 README 참고)
2. `.env`: `RAG_RETRIEVER=api`, `RAG_API_URL=http://127.0.0.1:8100`, `RAG_API_METHOD=4`(1~4안), `RAG_API_TOP_N=5`
3. 백엔드를 재시작합니다.

- LLM에는 검색된 문단 전문을 근거로 주고, 결론 → 근거·원리 → 적용 조건 순서로 답하게 합니다(`COMPOSE_SYSTEM_PAPERS`). 문장마다 출처를 달지 않습니다.
- 출처는 답변 아래에 **논문명만** 중복 없이 표시합니다(`CitationsBlock.style = "titles"`). 문단 전문은 응답 JSON에 싣지 않습니다.
- 교차언어 검색이 목적이라 질문 언어로 문단을 거르지 않습니다(한국어 질문 → 영어 논문).
- RAG 서버에 연결할 수 없으면 "자료 없음"으로 답하지 않고 503(`RAG_UNAVAILABLE`) 안내를 보여 줍니다. 첫 질문은 임베딩 모델을 불러오느라 수십 초 걸릴 수 있습니다(`RAG_WARMUP=1`로 서버 시작 때 미리 불러오기).

## 챗 동작 메모

- 계산 질문은 서버가 직접 계산기를 호출하고, 결과 카드의 숫자는 계산 결과에서 그대로 옮깁니다(LLM 미경유).
- 필수 값(GT 모델, HRSG 차압, 스택 온도)이 질문에 없으면 확인 카드를 보여 줍니다. "계산 실행"과 "가정 수정"은 같은 질문을 `calcContext.input`에 확정값을 담아 다시 보내며, 확정값이 질문 문장의 값보다 우선합니다.
- 결과 카드의 "계산기에서 열기"는 `/calculator?calcId=`로 이동해 같은 입력을 복원합니다. 계산 결과는 서버 메모리에만 있어 재시작하면 사라집니다.
- 스트리밍(SSE)과 대화 목록은 아직 없습니다(PRD Should). 응답이 블록 단위라 SSE로 바꿀 때 블록별로 보내면 됩니다.

## 플랜트 데이터 체크리스트

- 항목·문구는 `backend/app/checklist/templates/`의 YAML에서 관리합니다. `items.yaml`(구조: 카테고리·구분·우선순위·계산기 연결 필드)과 `default_ko.yaml`/`default_en.yaml`(항목명·기간·이메일 문구)의 id가 같아야 하며, 다르면 서버가 시작할 때 오류를 냅니다. 고친 뒤에는 서버를 재시작하세요.
- 체크 상태와 메모는 `data/checklist_state.json`에 저장되어 서버를 재시작해도 남습니다(Git 제외 — 메모에 고객 정보가 들어갈 수 있음). 경로는 `.env`의 `CHECKLIST_STATE_PATH`로 바꿀 수 있습니다.
- 서버 저장에 실패한 변경은 브라우저 localStorage에 임시 보관되고, 화면의 "다시 저장" 또는 다음 진입 때 다시 보냅니다.
- 체크와 상태는 연동됩니다: 체크하면 "받음", "받음"을 고르면 체크, "해당 없음"은 진행률 계산에서 뺍니다.
- 이메일 텍스트는 서버가 만듭니다(`email_formatter.py`). 받는 사람은 정해진 별칭만 고를 수 있고, 본문 전체에 발전소·고객사 실명 마스킹이 적용됩니다. 메모 속 사람 이름 등은 자동으로 가려지지 않으니 메모 포함 시 확인하세요.
- 계산기의 핀치 "데이터 필요" 링크는 체크리스트의 핀치/어프로치 섹션과 관련 항목을 강조해 보여 줍니다.

