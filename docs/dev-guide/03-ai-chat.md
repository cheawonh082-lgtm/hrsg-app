# 3단계. AI 챗 (대화 기록 사이드바 포함)

## 목표(결과)
- 실제 LLM 키·문서 없이도 챗이 끝까지 동작하고, 나중에 LLM(6단계)·문서(7단계)만 바꿔 끼울 수 있는 구조.
  - LLM 인터페이스 + Fake LLM(규칙 기반 답변, `LLM_PROVIDER=fake`), 문서 검색 인터페이스 + 키워드 검색 + 가상 예시 문서
  - 처리 흐름: 언어 감지 → 의도 분류(지식형/계산형) → 계산형이면 계산기 호출 → 결과 카드 → 숫자 검증
  - 가드레일: 프롬프트 인젝션·공식 요청 차단, 근거 없는 숫자 치환, 실명 마스킹
  - 화면: 처리 단계 표시, 계산 결과 카드, 파라미터 확인 카드, 출처 목록
- 대화 기록: 이전 대화를 저장해 두고 다시 연다.
  - 브라우저 localStorage에 최대 50개 저장(다른 기기·브라우저에는 보이지 않음), 새 대화·열기·삭제·전체 삭제
  - PC: 왼쪽 대화 기록 사이드바(접기 가능, 접으면 제목 왼쪽에 펼치기 버튼) / 모바일·태블릿: "대화 기록" 버튼 → 드로어

```
backend\app\chat\ (orchestrator.py, intent.py, cards.py, llm\base.py, llm\fake.py)
backend\app\rag\ (retriever.py, mock_docs\*.md), backend\app\guardrails\, backend\app\api\chat.py
frontend\src\pages\ChatPage.tsx, components\chat\ (ChatWindow, MessageBubble, CalcResultCard, ChatHistory …)
frontend\src\store\chat.ts (대화 기록 저장), frontend\e2e\chat.spec.ts, tests\backend\test_chat.py
```

## 입력한 프롬프트

### 3-1. 챗 구현
```
레퍼런스앱 현재 진행이 어디까지되었고 다음으로 뭘 해야할지 정리해줘
```
Claude가 PRD 로드맵 기준으로 다음 할 일(AI 챗)을 정리하면:
```
실제 LLM은 나중에 끼우고, rag에 넣을 문서는 나중에 제공할테니 이후 변경 가능하도록 작업해줘.
```

### 3-2. 대화 기록 사이드바
```
배포용에 ai챗 이전 기록 저장을 사이드바에 띄우는 형식으로 처리해줘
```
```
대화기록을 접었을 때 우측 상단에 있는 펼치기 바를 좌측 상단으로 이동시켜줘.
```

## 사용한 md 파일 위치

| 파일 | 로컬 경로 | GitHub 주소 | 용도 |
|---|---|---|---|
| PRD.md §2.5, §3.2 | `C:\Users\chaewon\hrsg-reference-app\PRD.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/PRD.md | 챗 응답 카드 구조, 챗 화면 명세("대화 목록: PC 좌측 고정 사이드바(접기 가능), 모바일·태블릿 Drawer") |
| 예시 문서 *.md (7개) | `C:\Users\chaewon\hrsg-reference-app\backend\app\rag\mock_docs` | https://github.com/cheawonh082-lgtm/hrsg-app/tree/main/backend/app/rag/mock_docs | 가상 예시 문서(한·영) — 실제 논문 연결 전 검색 대상 |
| README.md "실제 문서 넣기", "챗 동작 메모" | `C:\Users\chaewon\hrsg-reference-app\README.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/README.md | 문서 교체 방법, 챗 동작 설명 |

**이 단계 가이드 파일:** `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\03-ai-chat.md` · https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/03-ai-chat.md
