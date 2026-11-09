# HRSG 레퍼런스 앱 개발 가이드

복합화력 발전소 엔지니어용 웹 앱(**AI 질의응답 + 성능·경제성 계산기 + 플랜트 데이터 체크리스트**)을 Claude Code(VS Code 확장)로
처음부터 만드는 순서다. 단계마다 **목표(결과) · 입력한 프롬프트(Claude의 선택형 질문 포함) · 사용한 md 파일 위치**로 정리했다.

- **사람:** 무엇을 만들지 정하기 · Claude가 묻는 선택지 고르기 · 결과 확인 · 키·계정처럼 비밀이 필요한 일
- **Claude:** 문서 · 코드 · 테스트 · 설치 · 배포 파일 작성, 서버 실행·종료, 커밋·푸시

## 개발 순서

| 단계 | 하는 일 | 로컬 경로 | GitHub 주소 |
|---|---|---|---|
| 0 | 도구 설치와 폴더 만들기 | `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\00-setup.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/00-setup.md |
| 1 | 요구사항 명세(PRD.md) + 프로젝트 골격 | `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\01-skeleton.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/01-skeleton.md |
| 2 | 계산기 화면 (팀 공통 키트로 교체 포함) | `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\02-calculator.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/02-calculator.md |
| 3 | AI 챗 (대화 기록 사이드바 포함) | `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\03-ai-chat.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/03-ai-chat.md |
| 4 | 체크리스트 · 화면 연동 · 반응형 교차 검수 | `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\04-checklist-integration.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/04-checklist-integration.md |
| 5 | UI 디자인 개편 (체크리스트 상태 토글 포함) | `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\05-ui-design.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/05-ui-design.md |
| 6 | LLM 연결 | `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\06-llm.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/06-llm.md |
| 7 | 논문 RAG 검색 · 임베딩 모델 + 챗 출처 표기·답변 형식 | `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\07-rag-citations.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/07-rag-citations.md |
| 8 | 관리자 모드 | `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\08-admin.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/08-admin.md |
| 9 | 배포 (Render + Cloudflare) | `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\09-deploy.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/09-deploy.md |

## 진행 원칙
1. **명세 먼저, 코드는 나중.** `PRD.md`를 만든 뒤 단계별로 구현을 요청하고, 프롬프트에 "PRD.md §x 반영", "앞 단계 반영사항 존중"을 적는다.
2. **모르는 값은 Mock으로.** 공식·데이터·LLM 키·문서가 없어도 인터페이스 + Mock 구현으로 끝까지 만들고, 나중에 구현체만 바꾼다.
3. **단계마다 검증.** 프롬프트 끝에 "테스트 실행 결과를 알려 달라"를 붙인다.
4. **선택형 질문은 고르기만.** 모호한 부분은 Claude가 선택지로 묻는다. 추천(Recommended) 표시를 참고해 고르거나 직접 적는다.
5. **비밀값은 채팅에 붙여 넣지 않는다.** API 키는 `.env`와 Render 대시보드에 직접 넣고 "넣었어"라고만 답한다.
6. **유료 API는 아껴 쓴다.** 테스트·E2E는 `LLM_PROVIDER=fake`로 돌린다.

## 저장소
| 저장소 | 위치 | 내용 |
|---|---|---|
| hrsg-reference-app | `C:\Users\<사용자>\hrsg-reference-app` → GitHub `cheawonh082-lgtm/hrsg-app` (private) | 웹 앱 |
| hrsg-explorer-rag | `C:\Users\<사용자>\hrsg-explorer-rag` (로컬 전용) | 논문 RAG 검색 API, 평가, Cloudflare Worker |
