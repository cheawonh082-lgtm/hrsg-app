# 프롬프트 원문: 2단계 — 1주차 골격

실제로 입력한 프롬프트 그대로다. 아래 줄부터 끝까지 복사해 Claude Code에 붙여 넣는다. 설명: [02-week1-skeleton.md](../02-week1-skeleton.md)

---

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
