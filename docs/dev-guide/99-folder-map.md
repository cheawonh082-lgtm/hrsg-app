# 부록 — 폴더·파일 위치, 비밀값, 자주 쓴 운영 프롬프트

## 전체 폴더 배치

```
C:\Users\<사용자>\
├─ hrsg-reference-app\                 ← 웹 앱 (GitHub: cheawonh082-lgtm/hrsg-app, private)
│  ├─ PRD.md                           요구사항·설계 명세 (1단계)
│  ├─ README.md, DEPLOY.md             실행·테스트 / 배포 절차
│  ├─ render.yaml                      Render Blueprint (9단계)
│  ├─ .env.example                     환경변수 견본 (Git 포함)
│  ├─ .env                             실제 값·키 (Git 제외, 직접 입력)
│  ├─ docs\dev-guide\                  이 가이드
│  ├─ hrsg_calc_kit_team2\             팀 공통 계산기·체크리스트 키트 (수정 금지, 11단계)
│  ├─ backend\                         FastAPI (Python)
│  │  ├─ pyproject.toml
│  │  └─ app\
│  │     ├─ main.py, config.py, kit.py
│  │     ├─ api\                       HTTP 엔드포인트: calc, chat, checklist, admin, health
│  │     ├─ domain\models\             Pydantic 스키마
│  │     ├─ calculator\                CalculatorService, 키트 어댑터·구현, 결과 캐시, registry(DI)
│  │     ├─ chat\                      Orchestrator, 의도 분류, 카드, LLM(fake·gemini·claude)
│  │     ├─ rag\                       Retriever(키워드 / 원격 API), 예시 문서
│  │     ├─ guardrails\                입력 필터, 숫자 검증, 실명 마스킹
│  │     ├─ checklist\                 체크리스트 서비스·상태 저장
│  │     └─ admin\                     관리자 인증, 참고문헌 관리, 시스템 상태
│  ├─ frontend\                        Vite + React + TypeScript + Tailwind
│  │  ├─ package.json, vite.config.ts, playwright.config.ts
│  │  ├─ src\
│  │  │  ├─ pages\                     HomePage, CalculatorPage, ChatPage, ChecklistPage, AdminPage
│  │  │  ├─ components\                layout, calculator, chat, checklist, admin, home, common
│  │  │  ├─ api\                       client, hooks, schema.d.ts(gen:api)
│  │  │  ├─ store\                     zustand: chat(대화 기록), ui(테마·언어), calculator, toast
│  │  │  ├─ i18n\locales\              ko.json, en.json
│  │  │  └─ hooks\, lib\, theme\
│  │  └─ e2e\                          Playwright: calculator, chat, checklist, kit-expected, responsive
│  ├─ tests\backend\                   pytest
│  └─ data\checklist_state.json        체크 상태 (Git 제외)
│
└─ hrsg-explorer-rag\                  ← 논문 RAG 검색 (원격 저장소 없음, 7단계)
   ├─ rag_corpus\R???.json             논문 정리본 (Git 제외)
   ├─ hrsg_eval_set_v1\                평가셋 v1
   ├─ rag\, api\app.py, scripts\       검색 엔진, RAG API(포트 8100), 인덱스·평가·Cloudflare 스크립트
   ├─ cloudflare\worker\               배포판 검색 Worker
   ├─ eval\                            평가 결과·결정 기록
   ├─ data\rag\corpus_all.json, index\ 생성물 (Git 제외)
   └─ .env                             Cloudflare 자격 증명, RAG_API_KEY (Git 제외)
```

## 환경변수 (`hrsg-reference-app\.env`)

| 이름 | 값 예 | 뜻 |
|---|---|---|
| `CALC_ENGINE` / `DATA_SOURCE` | `mock` | `mock` = 키트 계산기·데이터 사용 (`real`은 실제 공식 자리, 미구현) |
| `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY` | `claude` / `claude-sonnet-5-5` / (키) | 챗 LLM. 키 없이 돌리려면 `fake` |
| `RAG_RETRIEVER` | `api` 또는 `keyword` | 논문 검색 API / 예시 문서 키워드 검색 |
| `RAG_API_URL`, `RAG_API_METHOD`, `RAG_API_TOP_N`, `RAG_API_KEY` | `http://127.0.0.1:8100`, `4`, `5` | 로컬 RAG API 또는 Cloudflare Worker |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_HOURS` | | 관리자 모드 |
| `RAG_CORPUS_DIR`, `RAG_CORPUS_ALL_PATH` | `../../hrsg-explorer-rag/...` | 관리자 참고문헌 관리 (로컬 전용) |

배포판은 `render.yaml`에 공개 값이, Render 대시보드에 비밀값(`LLM_API_KEY`, `ADMIN_PASSWORD`, `RAG_API_KEY`)이 있다.

## 자주 쓴 운영 프롬프트

| 하고 싶은 것 | 프롬프트 |
|---|---|
| 개발 서버 켜기 / 끄기 | `백엔드, 프론트엔드 실행해줘` / `두 서버 꺼줘` |
| 진행 상황 파악 | `현재 진행이 어디까지되었고 다음으로 뭘 해야할지 정리해줘` |
| 작업 잠시 멈춤 | `작업 잠시 중단하고 이후에 내가 계속해줘라고 하면 진행 개시해줘` → 나중에 `계속해줘` |
| 저장·배포 | `커밋해줘` / `푸시해줘` / `커밋하고 GitHub에 푸시해서 Render에 배포` |
| 배포 전 점검 | `아직 배포용에 커밋, 푸시되지 않은 기능들 정리해서 알려줘` |
| 개선 아이디어 받기 | `… 에 들어가면 좋을 기능들 정리해서 알려줘` → `1차로 진행해줘` |
| 요구사항 대조 | `(협업안 PDF 첨부) 해당 협업안의 전반적인 요구사항 중 불포함된 내용을 알려줘` |

## 테스트 명령
```bash
cd backend && .venv\Scripts\python -m pytest            # 백엔드
cd frontend && npm test                                  # 단위 (Vitest)
cd frontend && npm run build                             # 타입 검사 + 빌드
cd frontend && set LLM_PROVIDER=fake && set RAG_RETRIEVER=keyword && npm run test:e2e   # E2E (Fake LLM으로)
```
