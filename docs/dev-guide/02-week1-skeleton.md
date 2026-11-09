# 2. 1주차 — 프로젝트 골격 + Mock 계산기 API + AppShell

**목표:** 백엔드·프론트엔드가 함께 뜨고, Mock 계산 API와 반응형 틀(AppShell)이 동작하는 상태.

## 내가 입력한 프롬프트

원문: [prompts/02-week1-skeleton.md](prompts/02-week1-skeleton.md)

```
루트 디렉토리의 `PRD.md` 파일을 읽고 이해해 주세요.
우리는 `PRD.md`에 정의된 1주차 목표(모노레포 골격, 백엔드 FastAPI, Pydantic 데이터 모델, MockCalculator,
프론트엔드 Vite+React+TypeScript AppShell)를 개발할 것입니다.

### 1. 루트 프로젝트 & 디렉토리 구조 생성
### 2. 백엔드 구현 (FastAPI + Python 3.11)
### 3. 프론트엔드 구현 (Vite + React + TypeScript + Tailwind CSS)
### 4. 검증
위 내용을 작성하고 오류 없이 백엔드와 프론트엔드가 실행되는지 점검해 주세요.
```

## 결과 요약
- 모노레포: `backend/`(FastAPI) + `frontend/`(Vite React TS) + `tests/backend/`
- 계산 API 4개: `/api/calc/gt-models`, `/defaults`, `/thresholds`, `/evaluate`
- `CALC_ENGINE` 환경변수로 Mock/Real 계산기를 고르는 DI 팩토리
- AppShell: PC 상단 메뉴 / 모바일 하단 탭바, MOCK DATA 배너, 한국어·영어 전환, 라이트·다크 테마
- `npm run gen:api`: 백엔드 OpenAPI → `src/api/schema.d.ts` 타입 자동 생성

## 생기는 폴더·파일
```
hrsg-reference-app\
├─ .gitignore              secrets/, data/, .env, node_modules/, .venv/ 제외
├─ .env.example            환경변수 견본 (.env는 복사해서 만든다, Git 제외)
├─ backend\
│  ├─ pyproject.toml
│  └─ app\
│     ├─ main.py           FastAPI 앱, CORS(localhost:5173), 라우터
│     ├─ config.py         환경변수 설정 (pydantic-settings)
│     ├─ domain\models\calc.py      Pydantic v2 스키마 (camelCase)
│     ├─ calculator\base.py         CalculatorService 인터페이스
│     ├─ calculator\registry.py     CALC_ENGINE → 구현 선택
│     ├─ calculator\reference_data\ ReferenceDataProvider + Mock 데이터
│     └─ api\calc.py
├─ frontend\
│  ├─ package.json, vite.config.ts  (/api → 8000 프록시)
│  └─ src\
│     ├─ components\layout\AppShell.tsx
│     ├─ hooks\useBreakpoint.ts
│     └─ api\schema.d.ts            gen:api 결과
└─ tests\backend\test_calc.py
```

## 실행 (Claude에게 "백엔드, 프론트엔드 실행해줘"라고 해도 된다)
```bash
copy .env.example .env
cd backend && python -m venv .venv && .venv\Scripts\python -m pip install -e . --group dev
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000     # http://127.0.0.1:8000/docs
cd frontend && npm install && npm run gen:api && npm run dev          # http://localhost:5173
```

## 확인할 것
- `http://127.0.0.1:8000/api/health`가 JSON을 돌려주는가?
- `http://localhost:5173`에 MOCK DATA 배너와 메뉴가 보이는가? 폭을 줄이면 하단 탭바로 바뀌는가?
- `pytest`가 통과하는가?

## 궁금한 점은 질문
"서버가 왜 두 개야?" → 개발 중에는 화면 서버(Vite, 5173)와 API 서버(FastAPI, 8000)를 따로 띄워 화면을 고치면 바로 반영되게 한다.
배포 때는 화면을 빌드한 정적 파일로 묶는다(9단계).
