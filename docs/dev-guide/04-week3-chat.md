# 4. 3주차 — AI 챗 (Fake LLM + 예시 문서 + 가드레일)

**목표:** 실제 LLM 키·문서 없이도 챗 화면이 끝까지 동작하고, 나중에 LLM·문서만 바꿔 끼울 수 있는 구조.

## 내가 입력한 프롬프트

```
레퍼런스앱 현재 진행이 어디까지되었고 다음으로 뭘 해야할지 정리해줘
```
Claude가 PRD 로드맵 기준으로 남은 일(3주차 AI 챗)을 정리하면 이어서:
```
실제 LLM은 나중에 끼우고, rag에 넣을 문서는 나중에 제공할테니 이후 변경 가능하도록 작업해줘.
```

> 2·4주차처럼 상세 프롬프트를 쓰지 않고 "다음 할 일 정리 → 조건만 주고 진행"으로 해도 된다. PRD에 3주차 명세가 이미 있기 때문이다.

## 결과 요약
- **LLM 인터페이스** + `FakeLLM`(정규식으로 파라미터 추출, 고정 템플릿 답변). `LLM_PROVIDER=fake`가 기본
- **문서 검색 인터페이스**(`Retriever`) + 키워드 검색 + 가상 예시 문서(`mock_docs/`, 한·영)
- **Orchestrator:** 언어 감지 → 의도 분류(지식형/계산형) → 계산형이면 계산기 호출 → 결과 카드 → 숫자 검증
- **가드레일:** 프롬프트 인젝션·공식 요청 차단, 답변 속 숫자가 계산 결과·출처에 없으면 치환, 실명 마스킹
- 챗 화면: 처리 단계 표시(ProcessIndicator), 계산 결과 카드, 파라미터 확인 카드, 출처 목록
- 계산 결과 세션 캐시: `calcId`로 계산기 ↔ 챗 이동 시 입력 복원

## 생기는 폴더·파일
```
backend\app\
├─ chat\          orchestrator.py, intent.py, cards.py, tools.py, llm\base.py, llm\fake.py
├─ rag\           retriever.py, store.py, ingest.py, mock_docs\*.md
├─ guardrails\    input_filter.py, number_validator.py, redactor.py
├─ calculator\result_cache.py
└─ api\chat.py
frontend\src\
├─ pages\ChatPage.tsx
├─ components\chat\   ChatWindow, MessageBubble, CalcResultCard, ParamConfirmCard, ProcessIndicator, CitationList
└─ store\chat.ts
tests\backend\test_chat.py, test_guardrails.py
frontend\e2e\chat.spec.ts
```

## 확인할 것
- 챗 화면에 "개발 모드: Fake" 안내가 보이는가?
- "F급 GT, 차압 35mbar, 스택 110℃면 연간 손실은?" → 계산 결과 카드가 나오는가?
- "계산 공식 알려줘" → 거절 안내가 나오는가?
