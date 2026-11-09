# 5. 4주차 — 체크리스트 + 화면 간 연동 + 반응형 교차 검수

**목표:** 세 번째 화면(플랜트 데이터 체크리스트)을 만들고, 세 화면을 서로 연결하고, 모든 화면 폭·언어·테마에서 깨짐이 없는지 자동 검수.

## 내가 입력한 프롬프트

원문: [prompts/05-week4-checklist-integration.md](prompts/05-week4-checklist-integration.md)

```
우리는 `PRD.md` 및 이전 주차(1~3주차) 구현 결과를 바탕으로 **4주차 목표인 플랜트 데이터 체크리스트,
화면 간 통합 연동, 반응형 교차 검수 및 최종 통합 테스트**를 진행합니다.
3주차 반영사항(FakeLLM 키워드 규칙, 서버 메모리 캐시 특성, SSE 생략 등)을 그대로 존중하며 작업을 수행해 주세요.

1. 플랜트 데이터 요청 체크리스트 화면 (ProgressBar, ChecklistSection/Item, EmailExportDialog)
2. 화면 간 컨텍스트 연동 (계산기 → 챗, 챗 → 계산기, 체크리스트 → 계산기)
3. 반응형 레이아웃 교차 검수 (360~1920px 가로 스크롤 검사, visualViewport 키보드 보정, ko/en·라이트/다크)
4. 테스트 및 검수 (pytest, Vitest, Playwright checklist.spec.ts·responsive.spec.ts)
위 내용들을 구현하고 `npm run dev` 및 전체 테스트(`pytest`, `npm test`, Playwright) 실행 결과를 정리해 주세요.
```

이어서 확인용:
```
백앤드, 프론트앤드 실행해줘
두 서버 꺼줘
```

## 결과 요약
- 체크리스트: 전체·필수 진행률, 카테고리별 접기, 상태·메모, 이메일용 텍스트 복사(수신자는 별칭)
- 연동: 계산기 "AI에게 질문하기" → 챗에 계산 맥락 전달 / 챗 결과 카드 "계산기에서 열기" → 입력 복원 /
  핀치 "데이터 필요" → 체크리스트 해당 항목 강조
- 모바일 챗 입력창이 가상 키보드에 가리지 않도록 `visualViewport` 보정
- `responsive.spec.ts`: 360·390·768·1280px × (한국어·라이트 / 영어·다크) 가로 넘침·색 대비 검사 + 스크린샷

## 생기는 폴더·파일
```
backend\app\checklist\   service.py, store.py, registry.py
backend\app\api\checklist.py
data\checklist_state.json            체크 상태 저장 (Git 제외)
frontend\src\pages\ChecklistPage.tsx
frontend\src\components\checklist\   ProgressBar, ChecklistSection, ChecklistItem, EmailExportDialog
frontend\src\hooks\useVisualViewport.ts
frontend\e2e\checklist.spec.ts, responsive.spec.ts, responsive\layout.spec.ts
tests\backend\test_checklist.py
```

## 확인할 것
- 항목을 체크하면 진행률이 바로 바뀌고, 새로고침해도 유지되는가?
- 이메일 복사 버튼 → 클립보드에 문구가 들어가는가?
- 전체 E2E(`npm run test:e2e`, 약 3분)가 통과하는가?

여기까지가 PRD의 4주 PoC 범위다. 이후 단계(6~12)는 실제 LLM·논문·배포·운영 기능을 붙인 과정이다.
