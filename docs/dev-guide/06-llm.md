# 6단계. LLM 연결

## 목표(결과)
- Fake LLM 대신 실제 LLM이 답한다. 공급자는 환경변수만 바꿔 고른다.
  - `LLM_PROVIDER=fake|gemini|claude`, `LLM_MODEL`, `LLM_API_KEY` (루트 `.env`, Git 제외)
  - 현재: **Claude `claude-sonnet-5-5`** (사용량만큼 과금). Gemini 구현은 대안으로 남아 있다
  - 공급자들이 같은 프롬프트·출력 스키마(`llm/prompts.py`)를 써서 키만 바꾸면 전환
  - 테스트는 `.env`와 관계없이 항상 Fake(`tests/backend/conftest.py`)
- 배포판 키는 Render 대시보드 → `hrsg-reference-api` → Environment → `LLM_API_KEY`

```
hrsg-reference-app\.env                  LLM_PROVIDER / LLM_MODEL / LLM_API_KEY (직접 입력)
backend\app\chat\llm\                    base.py, fake.py, gemini.py, claude.py, prompts.py
```

## 입력한 프롬프트
```
AI질문 항목에 사용할 API Key 생성 및 연동해줘. 추가적으로 필요한 사항 있으면 요구해
```
```
모델은 구글 ai스튜디오 api로 변경.
```
최종 Claude로 교체 (7단계의 출처 표기 요청과 함께 입력):
```
3. api 모델을 클로드로 바꿔줘. 클로드 api키가 있으니 모델 바꿀 때 요청해줘.
```
Claude가 키를 넣을 위치(루트 `.env`, Render Environment)를 알려 주면 **직접** 입력하고:
```
키 두 곳 모두에 넣었어. 계속 진행해줘
```

> ⚠ API 키를 채팅에 붙여 넣지 않는다. 대화 기록 파일에 그대로 남는다. "키는 어디에 넣으면 돼?"라고 묻고, 알려 준 곳에 직접 넣은 뒤 "넣었어"라고만 답한다.

## 사용한 md 파일 위치

| 파일 | 로컬 경로 | GitHub 주소 | 용도 |
|---|---|---|---|
| README.md "실제 LLM 연결 (Gemini / Claude)" | `C:\Users\chaewon\hrsg-reference-app\README.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/README.md | 공급자별 키 발급처·기본 모델, `.env` 설정 방법 |
| .env.example | `C:\Users\chaewon\hrsg-reference-app\.env.example` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/.env.example | 환경변수 견본 (`.env`로 복사해 값 입력, `.env`는 Git 제외) |

**이 단계 가이드 파일:** `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\06-llm.md` · https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/06-llm.md
