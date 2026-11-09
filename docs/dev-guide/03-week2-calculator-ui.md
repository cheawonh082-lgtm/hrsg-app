# 3. 2주차 — 계산기 화면 UI

**목표:** 입력을 바꾸면 KPI·게이지·도식·그래프가 실시간으로 바뀌는 계산기 화면. PC·모바일 모두 레이아웃 깨짐 없음.

## 내가 입력한 프롬프트

원문: [prompts/03-week2-calculator-ui.md](prompts/03-week2-calculator-ui.md)

```
우리는 `PRD.md` 및 1주차 구현 결과를 바탕으로 **2주차 목표인 계산기 화면 UI 및 관련 오버레이/반응형 컴포넌트 전체**를 구현합니다.
1주차 반영사항(Python `.venv`, `hpDrumPressureBarg` 필드명, `frontend/e2e/` 구조 등)을 그대로 존중하며 작업을 진행해 주세요.

1. 공통 반응형 오버레이 컴포넌트 (BottomSheet, Drawer)
2. 계산기 입력 및 KPI 컴포넌트 (InputPanel 300ms 디바운스, KpiCard)
3. 시각화 차트 및 도식 (GaugeChart, HrsgDiagram, TrendChart)
4. 공법 비교 및 핀치 평가 (CleaningCostTable, PinchApproachPanel)
5. 페이지 조합 및 연동 (CalculatorPage, "AI에게 질문하기")
6. 테스트 및 검증 (Vitest, Playwright calculator.spec.ts)
위 내용들을 구현하고 `npm run dev` 및 테스트 실행 결과를 알려주세요.
```

> 팁: "1주차 반영사항을 존중"처럼 **앞 단계에서 정해진 이름·구조를 프롬프트에 적어 두면** 다음 단계에서 이름이 바뀌거나 중복 구현되는 일을 막을 수 있다.

## 결과 요약
- PC: 왼쪽 입력 패널(320px) + 오른쪽 대시보드 / 모바일: "입력 조정" 버튼 → 바텀시트(50%·90% 스냅)
- 슬라이더 + 숫자 입력, 300ms 디바운스로 `POST /api/calc/evaluate`, 범위 초과 시 zod 경고
- ECharts 게이지 3종, HRSG SVG 도식(PC 가로·모바일 세로), 차압-손실 감도 곡선
- 세정 공법 비교: PC 표 / 모바일 카드 리스트, 핀치·어프로치 평가("데이터 필요" → 체크리스트 링크)

## 생기는 폴더·파일
```
frontend\src\
├─ pages\CalculatorPage.tsx
├─ components\layout\   BottomSheet.tsx, Drawer.tsx, ResponsiveTable.tsx
├─ components\calculator\   InputPanel, KpiCard, GaugeChart, HrsgDiagram(6단계 개편 후 HrsgSchematic), TrendChart, CleaningCostTable, PinchApproachPanel …
└─ hooks\useCalculate.ts
frontend\e2e\calculator.spec.ts      360px·1280px E2E
```

## 확인할 것
- 슬라이더를 움직이면 KPI 숫자가 바로 바뀌는가?
- 360px 폭(모바일)에서 가로 스크롤이 생기지 않는가?
- `npm test`, `npx playwright test e2e/calculator.spec.ts`가 통과하는가?
