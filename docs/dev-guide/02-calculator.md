# 2단계. 계산기 화면 (팀 공통 키트로 교체 포함)

## 목표(결과)
- 입력을 바꾸면 KPI·게이지·도식·그래프가 실시간으로 바뀌는 계산기 화면. PC·모바일 모두 레이아웃 깨짐 없음.
  - PC: 왼쪽 입력 패널(320px) + 오른쪽 대시보드 / 모바일: "입력 조정" 버튼 → 바텀시트(50%·90% 스냅)
  - 슬라이더 + 숫자 입력, 300ms 디바운스로 계산 요청, 범위 초과 시 경고
  - 게이지 3종, HRSG 도식(PC 가로·모바일 세로), 손실 감도 곡선, 세정 공법 비교(PC 표·모바일 카드), 핀치·어프로치 평가
- 계산 로직은 팀 공통 키트(`hrsg_calc_kit_team2`)를 그대로 쓴다.
  - 키트 `calc.py`·`checklist.py`·`data/`는 고치지 않고 백엔드가 불러 쓴다. 화면 입력 ↔ 키트 입력 변환은 어댑터 하나(`kit_adapter.py`)
  - 처음 화면 = 키트 예시 운전 상태, 「초기화」 = 설계 상태, 연간 운전시간 + 월간 가동시간 입력
  - 공법은 「순편익 최대」로 표시("추천" 표기 안 함), 계산식은 비공개, DEMO 값 표시(MOCK DATA 배너) 유지
  - 체크리스트 항목·진행률·메일 문구도 키트 함수로 바뀐다(4단계 화면)

```
frontend\src\pages\CalculatorPage.tsx
frontend\src\components\calculator\   InputPanel, KpiCard, GaugeChart, HrsgSchematic, TrendChart, CleaningCostTable, PinchApproachPanel …
frontend\src\components\layout\       BottomSheet.tsx, Drawer.tsx, ResponsiveTable.tsx
backend\app\kit.py, calculator\kit_adapter.py, calculator\kit_calculator.py
frontend\e2e\calculator.spec.ts, kit-expected.spec.ts
```

## 입력한 프롬프트

### 2-1. 계산기 화면 구현
```
우리는 `PRD.md` 및 1주차 구현 결과를 바탕으로 **2주차 목표인 계산기 화면 UI 및 관련 오버레이/반응형 컴포넌트 전체**를 구현합니다.

1주차 반영사항(Python `.venv`, `hpDrumPressureBarg` 필드명, `frontend/e2e/` 구조 등)을 그대로 존중하며 작업을 진행해 주세요.

---

### 2주차 구현 요청 사항

#### 1. 공통 반응형 오버레이 컴포넌트 구현
- `src/components/layout/BottomSheet.tsx`:
  - 모바일(`base`~`sm`) 환경 전용 드래그 바텀시트
  - 50% / 90% 스냅 포인트, 드래그 및 Esc/배경 클릭 닫기 지원
  - 시트 상단에 주요 KPI 요약(총 손실, 상태) 1줄 고정 노출 (시트를 열고 값을 조절하는 동안 결과 실시간 확인 가능)
- `src/components/layout/Drawer.tsx`:
  - 좌측 슬라이드 패널 (모바일/태블릿 대화 목록 및 메뉴용)

#### 2. 계산기 입력 및 KPI 컴포넌트
- `src/components/calculator/InputPanel.tsx`:
  - 가스터빈 모델 선택 드롭다운 (선택 시 정격 기본값 입력)
  - 슬라이더 + 숫자 입력(inputmode="decimal") 병행
  - "고급 입력" 아코디언 (증기 유량, 핀치/어프로치 입력) 및 경제성 입력
  - **300ms 디바운스** 적용하여 `POST /api/calc/evaluate` 호출 (`useCalculate` 훅)
  - 입력 범위 초과 시 zod 유효성 검사 경고 및 계산 차단
- `src/components/calculator/KpiCard.tsx`:
  - 큰 수치(tabular-nums), 단위, 기준 대비 차이(▲/▼), 상태 Pill 표기
  - 수치 변경 시 smooth transition 애니메이션 (`prefers-reduced-motion` 존중)

#### 3. 시각화 차트 및 도식 컴포넌트
- `src/components/calculator/GaugeChart.tsx`:
  - `echarts-for-react` 기반 배압, 차압, 스택온도 게이지 3종
  - 백엔드 `/api/calc/thresholds`에서 받은 임계값 색상(정상/주의/위험) 적용
  - `ResizeObserver`로 화면 크기 및 창 회전 시 `chart.resize()` 자동 호출
- `src/components/calculator/HrsgDiagram.tsx`:
  - React 인라인 SVG 기반 HRSG 구조도
  - `useBreakpoint` 결과에 따라 **PC/태블릿은 가로 흐름 도식, 모바일은 세로 흐름 도식**으로 반응형 전환
  - `SectionHealth` 데이터에 맞춰 섹션별 상태 색상 적용
  - 섹션 hover/탭 시 가스 입출구 온도 및 상태 툴팁 표시
- `src/components/calculator/TrendChart.tsx`:
  - ECharts 기반 ΔP vs totalPowerLossMw 손실 감도 곡선
  - 현재 ΔP 지점에 수직 마커 및 위험 구간 배경 밴드 표시

#### 4. 공법 비교 및 핀치 평가 컴포넌트
- `src/components/calculator/CleaningCostTable.tsx`:
  - `ResponsiveTable` 패턴 적용: PC(`md` 이상)는 정렬 가능한 표, 모바일(`base`)은 카드 리스트로 자동 전환
  - 공법별 비용, 정지일수, 회수율, 회수기간, 순편익 표기 및 추천 공법 배지 강조
- `src/components/calculator/PinchApproachPanel.tsx`:
  - HP/IP/LP 핀치 및 어프로치 포인트 평가 카드
  - 필수 데이터 미입력 시 `status='insufficient_data'` 처리 ("데이터 필요" 안내 및 `/checklist` 이동 링크)

#### 5. 페이지 조합 및 연동 (`src/pages/CalculatorPage.tsx`)
- 위 컴포넌트들을 `PRD.md §3.1` 및 `§3.4` 반응형 레이아웃에 맞게 통합
- PC: 좌측 `InputPanel` (320px 고정) + 우측 대시보드
- 모바일: 메인 화면에 KPI + 차트 + 도식 노출, 하단 고정 "입력 조정" Floating 버튼 클릭 시 `BottomSheet`로 `InputPanel` 오픈
- 하단에 **"AI에게 질문하기"** 버튼 제공 → 클릭 시 현재 `calcId`를 state로 지니고 `/chat` 페이지로 이동 준비

#### 6. 테스트 및 검증
- Vitest/RTL 단위 테스트: `InputPanel` 디바운스 동작 및 `KpiCard` 수치 포맷팅 테스트
- Playwright E2E: `frontend/e2e/calculator.spec.ts` 작성 (360px 모바일 및 1280px 데스크톱 환경에서 입력값 조절 시 KPI 및 차트 정상 업데이트 검증)

위 내용들을 구현하고 `npm run dev` 및 테스트 실행 결과를 알려주세요.
```

### 2-2. 팀 공통 키트로 교체 (키트 폴더를 저장소 루트에 복사한 뒤)
```
C:\Users\chaewon\hrsg-reference-app\hrsg_calc_kit 폴더 안에 있는 md파일 읽어줘
```
```
C:\Users\chaewon\hrsg-reference-app\hrsg_calc_kit_team2 폴더 제목만 변경했어 안에 내용은 똑같아. 기존 계산기를 대체하는 방향으로 바꿔줘. 키트의 지시대로 모두 수행한 뒤 수정 제안 사항을 알려줘.
```
Claude가 수정 제안을 보고하면 결정 사항을 지시:
```
연간 운전시간으로 바꿔서 월간 가동시간 입력란을 둬. 키트에 한국어 뿐이라면 영어로 번역은 없애. 키트 md파일 규칙에 따라 공개 여부 결정해. 수정 후 커밋하고 푸시해줘.
```

## 사용한 md 파일 위치

| 파일 | 로컬 경로 | GitHub 주소 | 용도 |
|---|---|---|---|
| PRD.md §3.1, §3.4 | `C:\Users\chaewon\hrsg-reference-app\PRD.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/PRD.md | 계산기 화면·반응형 명세 |
| README.md (키트) | `C:\Users\chaewon\hrsg-reference-app\hrsg_calc_kit_team2\README.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/hrsg_calc_kit_team2/README.md | 키트 구성, 화면 ↔ 키트 입력·결과 연결표, 기대값 |
| CLAUDE.md (키트) | `C:\Users\chaewon\hrsg-reference-app\hrsg_calc_kit_team2\CLAUDE.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/hrsg_calc_kit_team2/CLAUDE.md | 키트 작업 규칙 (키트 파일 수정 금지, DEMO 표시 유지, "추천" 표기 금지 등) — Claude가 따른다 |
| FORMULAS.md (키트) | `C:\Users\chaewon\hrsg-reference-app\hrsg_calc_kit_team2\FORMULAS.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/hrsg_calc_kit_team2/FORMULAS.md | 계산식 (화면·챗에 공개하지 않음) |
| CHECKLIST.md (키트) | `C:\Users\chaewon\hrsg-reference-app\hrsg_calc_kit_team2\CHECKLIST.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/hrsg_calc_kit_team2/CHECKLIST.md | 체크리스트 항목·상태·함수 |

**이 단계 가이드 파일:** `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\02-calculator.md` · https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/02-calculator.md
