# 1단계. 요구사항 명세(PRD.md) + 프로젝트 골격

## 목표(결과)
- 프로젝트 계획서가 개발 명세서 `PRD.md`(아키텍처·데이터 모델·화면 명세·Mock 설계·4주 로드맵·반응형 명세)로 정리된다.
- 백엔드(FastAPI)와 프론트엔드(Vite + React + TypeScript)가 함께 뜨고, Mock 계산 API 4개와 반응형 틀(AppShell)이 동작한다.
  - 계산 API: `/api/calc/gt-models`, `/defaults`, `/thresholds`, `/evaluate` — `CALC_ENGINE` 환경변수로 구현체 선택
  - AppShell: MOCK DATA 배너, 한국어·영어 전환, 라이트·다크 테마, PC 상단 메뉴 / 모바일 하단 탭바
  - `npm run gen:api`: 백엔드 OpenAPI → `frontend/src/api/schema.d.ts` 타입 자동 생성

```
hrsg-reference-app\
├─ PRD.md, .gitignore, .env.example (→ .env 복사, Git 제외)
├─ backend\pyproject.toml, backend\app\ (main.py, config.py, domain\models\, calculator\, api\calc.py)
├─ frontend\ (package.json, vite.config.ts, src\components\layout\AppShell.tsx, src\hooks\useBreakpoint.ts)
└─ tests\backend\test_calc.py
```

## 입력한 프롬프트

### 1-1. PRD 작성 (프로젝트 계획서 요약을 붙여 넣음)
```
# Task
아래 제공된 [프로젝트 계획서]를 바탕으로, 웹 프론트엔드/백엔드 개발을 바로 진행할 수 있는 상세한 **Markdown (.md) 형태의 개발 명세서(PRD 및 기술 설계서)**를 작성해 주세요.

---

## ⚠️ 중요 개발 요건 및 개발 현황 (중요)
1. **계산 공식 및 실측 데이터 미확정 (Mocking 처리 필수)**:
   - 현재 정확한 계산 공식(영업비밀)과 가스터빈/실적 데이터는 아직 제공받지 않은 상태입니다.
   - 따라서 **계산 로직 및 데이터 처리 부분은 인터페이스(Interface/Type)와 Mock 함수(가짜 데이터 반환 함수)로 모듈화**하여 작성해야 합니다.
   - 추후 실제 계산 공식 알고리즘 및 데이터가 입수되었을 때 함수 내부 로직만 쉽게 교체할 수 있도록 확장성 있게 구조를 설계해 주세요.

2. **AI 수치 생성 금지 (가드레일)**:
   - AI 질의응답 기능 구현 시, 수치 계산 질문은 AI가 임의로 숫자를 지어내지 않고 반드시 내부 계산기 모듈(또는 API)을 호출한 결과를 기반으로 응답 카드를 생성하도록 설계 구조를 명시해 주세요.

3. **보안 및 제약 사항**:
   - 원문 파일, 고객사/발전소명, 사내 내부 계산 공식은 노출되지 않도록 가드레일을 적용해야 합니다.

---

## 📄 [프로젝트 계획서 요약 정보]

### 1. 프로젝트 개요
* **프로젝트명**: HRSG 레퍼런스 앱 (PoC 4주 프로젝트)
* **목적**: 복합화력 발전소 엔지니어를 위한 AI 질의응답 + 성능·경제성 계산기 + 플랜트 데이터 요청 체크리스트 웹 앱
* **형태**: 웹 앱 (로컬 실행 환경), 한국어 기본 및 영어 지원, 라이트/다크 모드

### 2. 도메인 배경
* **HRSG(배열회수보일러)**: 가스터빈 고온 배기가스(500~650℃)의 폐열로 증기를 만들어 2차 발전을 수행하는 설비.
* **주요 오염 문제**:
  - 튜브 핀(fin) 표면 오염 → 유동 저항 증가(차압 ΔP 상승, 가스터빈 배압 증가) → 출력/효율 저하.
  - 열전달 저항 증가 → 증기 생산량 감소, 스택(굴뚝) 온도 상승.

### 3. 주요 기능 요건
1. **질문하기 (AI 질의응답)**:
   - RAG 기반 기술 자료/사례 응답.
   - 수치 기반 질의 시 계산기 연동 결과 카드 출력.
   - 한국어/영어 입력에 맞춘 언어 응답.
2. **성능·경제성 계산기**:
   - 입력: 가스터빈 모델, 운전 상태(배압, 스택 온도, 차압 등).
   - 출력: 현재 상태, 예상 손실, 세정 시 회수 효과, 세정 공법별 비용 비교, 핀치/어프로치 포인트 평가.
   - UI: 큰 숫자(KPI), 상태 색상(정상/주의/위험), 게이지 차트, HRSG 구조 도식, 실시간 그래프 반응.
3. **플랜트 데이터 요청 체크리스트**:
   - 운전/설계 데이터 요구사항 체크리스트 (가스터빈, 배기가스, 급수/증기, 핀치/어프로치 평가 항목 등).
   - 진행 상황 체크, 이메일용 텍스트 복사 기능 제공.

---

## 🎯 작성 요청 내용 (Markdown 구조)

다음 항목들을 포함하여 완벽한 `README.md` 또는 `PRD.md` 파일 내용으로 출력해 주세요:

1. **프로젝트 개요 & 시스템 아키텍처**
   - 로컬 웹 앱 실행 구조 (예: React/Next.js/Vite + Python FastAPI 또는 Node.js)
   - 디렉토리 구조 제안

2. **데이터 모델 및 타입 정의 (TypeScript / Python)**
   - 가스터빈 입력 데이터 인터페이스 (Model, Pressure, Temp, Flow rate 등)
   - 계산기 결과 데이터 구조 (Loss, Recovery, Cost Comparison)
   - 체크리스트 데이터 및 AI 응답 카드 데이터 구조

3. **화면별 UI/UX 명세 및 컴포넌트 설계**
   - **대시보드 / 계산기 화면**: 게이지, HRSG 구조 인터랙티브 도식, 실시간 입력 변환 UI
   - **AI 질의응답 화면**: 챗 인터페이스, AI 처리 프로세스, 계산기 결과 매핑 카드 컴포넌트
   - **플랜트 데이터 체크리스트 화면**: 체크 박스, 진행률 프로그레스 바, 이메일 클립보드 복사 기능

4. **Mock 서비스 및 계산 로직 추상화 명세**
   - 추후 실제 계산 공식 적용을 위한 `CalculatorService` 인터페이스 정의 및 가짜(Mock) 계산 함수 구현 가이드
   - AI 가드레일 (숫자 임의 생성 방지 및 계산 모듈 강제 연동) 구현 정책

5. **개발 로드맵 & 검수 가이드**
   - 4주간의 단계별 구현 계획 및 테스트 시나리오 반영 기준

위 요구사항을 바탕으로 바로 프로젝트에 사용할 수 있는 완전한 Markdown 코드를 작성해 주세요.
```

### 1-2. 반응형 요구 추가
```
md파일에 모바일/pc화면이 구현되며 레이아웃깨짐이 없도록 하는 구현기능을 추가해줘.
```

### 1-3. 골격 구현
```
루트 디렉토리의 `PRD.md` 파일을 읽고 이해해 주세요.
우리는 `PRD.md`에 정의된 1주차 목표(모노레포 골격, 백엔드 FastAPI, Pydantic 데이터 모델, MockCalculator, 프론트엔드 Vite+React+TypeScript AppShell)를 개발할 것입니다.

다음 작업들을 순서대로 수행해 주세요:

### 1. 루트 프로젝트 & 디렉토리 구조 생성
- 백엔드 (`/backend`) 및 프론트엔드 (`/frontend`) 모노레포 구조 세팅
- `.gitignore` 생성 (`secrets/`, `data/`, `.env`, `node_modules/`, `venv/` 등 PRD §5 기준 포함)
- `.env.example` 및 `.env` 파일 생성

### 2. 백엔드 구현 (FastAPI + Python 3.11)
- `backend/pyproject.toml` 생성 (dependencies: fastapi, uvicorn, pydantic, pydantic-settings 등)
- `backend/app/domain/models/calc.py`: PRD §2.2, §2.3 기반 Pydantic V2 스키마 작성 (camelCase alias 적용)
- `backend/app/calculator/base.py`: PRD §4.2 `CalculatorService` (ABC) 인터페이스 정의
- `backend/app/calculator/reference_data/`:
  - `provider.py`: `ReferenceDataProvider` 인터페이스
  - `mock_gt_models.json`: PRD §4.3 기반 가상 가스터빈 사양 데이터 작성
  - `mock.py`: `MockReferenceData` 구현
- `backend/app/calculator/mock.py`: PRD §4.3 기반 결정적(deterministic) 계산 로직을 가진 `MockCalculator` 구현
- `backend/app/calculator/registry.py`: `CALC_ENGINE` 환경변수에 따른 DI 팩토리 작성
- `backend/app/api/calc.py`: `/api/calc/gt-models`, `/api/calc/defaults`, `/api/calc/thresholds`, `/api/calc/evaluate` 엔드포인트 구현
- `backend/app/main.py`: FastAPI 앱 설정, CORS 설정(localhost:5173), 라우터 등록

### 3. 프론트엔드 구현 (Vite + React + TypeScript + Tailwind CSS)
- Vite React TypeScript 스크립트로 `/frontend` 초기화
- Tailwind CSS 설정 및 dark 모드 지원 설정 (`theme/` 관련 토큰)
- `package.json` 세팅 및 필요한 라이브러리 추가 (`@tanstack/react-query`, `zustand`, `lucide-react`, `i18next`, `react-i18next`, `clsx`, `tailwind-merge` 등)
- OpenAPI 타입 자동 생성 스크립트 세팅 (`npm run gen:api`) 및 `src/api/schema.d.ts` 최초 생성
- `src/components/layout/AppShell.tsx`:
  - `PRD.md §3.4` 반응형 명세 반영
  - 상단 TopNav (PC/태블릿) / 하단 BottomTabBar (모바일)
  - MOCK DATA 상단 배너
  - KO/EN 다국어 선택기 및 라이트/다크 테마 토글 버튼
- `src/hooks/useBreakpoint.ts`: 화면 폭(media query) 기반 브레이크포인트 훅 구현

### 4. 검증
- 백엔드 실행 명령어: `uv run uvicorn app.main:app --reload --port 8000` (또는 venv 기반)
- 프론트엔드 실행 및 API 타입 추출: `npm run gen:api` 후 `npm run dev`
- `/api/calc/evaluate` 엔드포인트에 대한 Pytest 계약 테스트 작성 (`tests/backend/test_calc.py`)

위 내용을 작성하고 오류 없이 백엔드와 프론트엔드가 실행되는지 점검해 주세요.
```

### 1-4. 확인
```
백앤드, 프론트앤드 실행해줘
```

## 사용한 md 파일 위치

| 파일 | 로컬 경로 | GitHub 주소 | 용도 |
|---|---|---|---|
| PRD.md | `C:\Users\chaewon\hrsg-reference-app\PRD.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/PRD.md | 1-1에서 생성. 이후 모든 단계 프롬프트가 "PRD.md §2.2"처럼 참조 |
| README.md | `C:\Users\chaewon\hrsg-reference-app\README.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/README.md | 실행·테스트 방법 (Claude가 작성·갱신) |

**이 단계 가이드 파일:** `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\01-skeleton.md` · https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/01-skeleton.md
