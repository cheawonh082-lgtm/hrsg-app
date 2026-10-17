# HRSG 레퍼런스 앱 (PoC)

복합화력 발전소 엔지니어를 위한 AI 질의응답 + 성능·경제성 계산기 + 플랜트 데이터 체크리스트 웹 앱.
제품·기술 명세는 [PRD.md](PRD.md) 참조.

> ⚠ 현재 계산 엔진과 레퍼런스 데이터는 모두 **Mock(가상 값)** 입니다. 화면의 수치는 검증되지 않았습니다.

## 구성

| 경로 | 내용 |
|---|---|
| `backend/` | FastAPI + Pydantic v2. 계산기 인터페이스(`app/calculator/base.py`)와 Mock 구현 |
| `frontend/` | Vite + React 18 + TypeScript + Tailwind v4. 반응형 AppShell |
| `tests/backend/` | 계산기 API 계약 테스트 (pytest) |
| `frontend/src/**/*.test.tsx` | 컴포넌트 단위 테스트 (Vitest + Testing Library) |
| `frontend/e2e/` | 계산기·뷰포트별 레이아웃 E2E (Playwright) |

## 실행

필요: Python 3.11+, Node 20+, Chrome(E2E용)

```bash
# 1) 환경변수
cp .env.example .env

# 2) 백엔드 — http://127.0.0.1:8000/docs
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -e . --group dev      # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
#   uv 사용 시: uv sync && uv run uvicorn app.main:app --reload --port 8000

# 3) 프론트엔드 — http://localhost:5173  (/api 요청은 dev 서버가 8000번으로 프록시)
cd frontend
npm install
npm run gen:api     # 백엔드 실행 중일 때, 스키마 변경 시마다
npm run dev
```

## 테스트

```bash
cd backend && .venv/Scripts/python -m pytest          # 계약 테스트
cd frontend && npm test                                # 단위 테스트 (Vitest, src/**/*.test.tsx)
cd frontend && npm run build                           # 타입 검사 + 빌드
cd frontend && npm run test:e2e                        # 반응형 레이아웃 (서버 미실행 시 자동 기동)
```

## 실제 계산 공식 적용

`.env`의 `CALC_ENGINE=real`로 바꾸면 `RealCalculator`가 사용됩니다(현재는 501 응답).
교체 절차는 PRD §4.4 참조 — 공식·실측 데이터는 `secrets/`(Git 미추적)에만 둡니다.
