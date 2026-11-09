# HRSG 레퍼런스 앱 개발 가이드 (Claude Code로 처음부터 만들기)

복합화력 발전소 엔지니어용 웹 앱 — **AI 질의응답 + 성능·경제성 계산기 + 플랜트 데이터 체크리스트** — 을
Claude Code(VS Code 확장)로 처음부터 만든 과정을 순서대로 정리했다. 실제로 입력한 프롬프트, 만들어지는 폴더·파일 위치,
단계마다 확인할 것을 담았다. 그대로 따라 하면 같은 구조의 앱을 다시 만들 수 있다.

- **사람:** 무엇을 만들지 정하기 · 선택지 중 고르기 · 결과 확인 · 키·계정처럼 비밀이 필요한 일
- **Claude:** 문서 · 코드 · 테스트 · 설치 · 배포 파일 작성, 서버 실행·종료, 커밋·푸시

## 개발 순서

| 단계 | 하는 일 | 핵심 프롬프트 | 문서 |
|---|---|---|---|
| 0 | 도구 설치, 폴더 준비 | "모든 답변과 설명, 코드 주석은 반드시 한국어로 작성해 주세요." | [00-setup.md](00-setup.md) |
| 1 | 요구사항 → `PRD.md` | "[프로젝트 계획서]를 바탕으로 … 개발 명세서(PRD)를 작성해 주세요" | [01-prd.md](01-prd.md) |
| 2 | 1주차: 골격 + Mock 계산기 API + AppShell | "`PRD.md`에 정의된 1주차 목표를 개발할 것입니다" | [02-week1-skeleton.md](02-week1-skeleton.md) |
| 3 | 2주차: 계산기 화면 | "2주차 목표인 계산기 화면 UI … 를 구현합니다" | [03-week2-calculator-ui.md](03-week2-calculator-ui.md) |
| 4 | 3주차: AI 챗 (Fake LLM + 예시 문서 + 가드레일) | "실제 LLM은 나중에 끼우고 … 이후 변경 가능하도록 작업해줘" | [04-week3-chat.md](04-week3-chat.md) |
| 5 | 4주차: 체크리스트 + 화면 연동 + 반응형 검수 | "4주차 목표인 플랜트 데이터 체크리스트 … 를 진행합니다" | [05-week4-checklist-integration.md](05-week4-checklist-integration.md) |
| 6 | 디자인 개편 + 실제 LLM 연결 | "다음 UI 이미지의 레퍼런스를 참고해서 …" / "api 모델을 클로드로 바꿔줘" | [06-design-and-llm.md](06-design-and-llm.md) |
| 7 | 논문 RAG 검색 (별도 저장소) + 임베딩 모델 선정 | "RAG API를 만들어 줘" / "hrsg_eval_set_v1 … 그 내용대로 실행해줘" | [07-rag-search.md](07-rag-search.md) |
| 8 | 챗 답변 형식·출처 표기 | "ai챗봇 ui를 다음 링크의 형식으로 만들어줘" | [08-chat-ui-citations.md](08-chat-ui-citations.md) |
| 9 | 배포 (GitHub → Render, Cloudflare Worker) | "Render로 배포하고 싶은데 github 리포지토리 생성부터 …" | [09-deploy.md](09-deploy.md) |
| 10 | 관리자 모드 | "관리자 모드에 들어가면 좋을 기능들 정리해서 알려줘" | [10-admin-mode.md](10-admin-mode.md) |
| 11 | 계산기·체크리스트를 팀 공통 키트로 교체 | "기존 계산기를 대체하는 방향으로 바꿔줘. 키트의 지시대로 …" | [11-team-kit.md](11-team-kit.md) |
| 12 | 대화 기록 사이드바 + 체크리스트 토글 | "ai챗 이전 기록 저장을 사이드바에 띄우는 형식으로 처리해줘" | [12-chat-history.md](12-chat-history.md) |
| 부록 | 전체 폴더·파일 위치, 비밀값 위치, 자주 쓴 운영 프롬프트 | | [99-folder-map.md](99-folder-map.md) |

긴 프롬프트 원문은 [prompts/](prompts/) 폴더에 그대로 두었다. 복사해서 붙여 넣으면 된다.

## 진행 원칙 (전 단계 공통)

1. **명세 먼저, 코드는 나중.** `PRD.md`를 만든 뒤 "주차(Phase)"별로 구현을 요청한다. 프롬프트마다 "PRD.md §x 반영",
   "이전 주차 반영사항을 존중"을 적어 앞 단계 결정이 뒤집히지 않게 한다.
2. **모르는 값은 Mock으로.** 계산 공식·실측 데이터·LLM 키·문서가 없어도 인터페이스 + Mock 구현으로 먼저 끝까지 만든다.
   실제 것이 들어오면 구현체만 바꾼다 (`CALC_ENGINE`, `LLM_PROVIDER`, `RAG_RETRIEVER` 환경변수).
3. **단계마다 검증.** 프롬프트 끝에 "테스트 실행 결과를 알려 달라"를 붙인다. Claude가 pytest·Vitest·Playwright를 돌리고 결과를 보고한다.
4. **Claude가 선택형 질문을 하면 고른다.** 모호한 부분(예: 키를 어디에 둘지, 어떤 방식으로 연결할지)은 Claude가 선택지로 묻는다.
5. **비밀값은 채팅에 붙여 넣지 않는다.** API 키는 루트 `.env`(Git 제외)와 Render 대시보드에 **직접** 입력하고 "넣었어"라고만 말한다.
   채팅에 붙여 넣은 키는 대화 기록 파일에 남으므로, 그런 키는 폐기하고 새로 발급한다.
6. **유료 API는 아껴 쓴다.** 테스트·E2E는 `LLM_PROVIDER=fake`로 돌린다. 실제 키를 쓰는 백엔드를 켜 둔 채 E2E를 돌리면 과금된다.

## 저장소

| 저장소 | 위치 | 내용 |
|---|---|---|
| hrsg-reference-app | `C:\Users\<사용자>\hrsg-reference-app` → GitHub `cheawonh082-lgtm/hrsg-app` (private) | 웹 앱 (백엔드 + 프론트엔드), 이 가이드 |
| hrsg-explorer-rag | `C:\Users\<사용자>\hrsg-explorer-rag` (원격 저장소 없음, 로컬 전용) | 논문 RAG 검색 API, 평가, Cloudflare Worker |

두 폴더는 같은 부모 폴더(사용자 홈) 아래 나란히 둔다. 앱의 `.env`가 `../../hrsg-explorer-rag/...` 상대 경로로 논문 폴더를 찾는다.
