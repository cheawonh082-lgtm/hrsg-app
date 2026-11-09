# 9. 배포 — GitHub → Render (무료), 논문 검색은 Cloudflare Worker

**목표:** 누구나 주소로 접속할 수 있는 배포판. 백엔드·화면은 Render 무료 플랜, 논문 검색은 Cloudflare Workers AI + Vectorize.

## 9-1. GitHub 저장소 + Render

### 내가 입력한 프롬프트
```
이제 이 웹앱을 Render로 배포하고 싶은데 github리포지토리 생성하고 올리는 것부터 시작해서
배포에 필요한 파일들을 생성하고 절차 안내해줘, github와 render계정은 새로 만들어 두었어.
참고로 모두 무료 plan을 사용할거야.
```
사람이 할 일(계정·저장소 만들기, Blueprint 적용)을 하고 결과를 그대로 알려 준다:
```
다른 계정으로 생성했어. https://github.com/<계정>/hrsg-app.git
blueprint만들었어
(Render 화면 문구를 붙여 넣고) 이런 문구가 떴어
완료했어
```

### 결과 요약
- `render.yaml`(Blueprint): 서비스 2개
  - `hrsg-reference-api` — Python 웹 서비스(FastAPI, `backend/`)
  - `hrsg-reference-web` — 정적 사이트(`frontend/dist`), `/api/*`는 백엔드로 rewrite → CORS 설정 불필요
- `DEPLOY.md`: 저장소 만들기 → push → Blueprint → 환경변수 → 확인 절차
- 이후 `main`에 push하면 자동 재배포

### 사람이 직접 하는 일
1. GitHub에서 빈 private 저장소 생성 (README·.gitignore 추가하지 않음)
2. Render → New + → Blueprint → 저장소 연결 → Apply
3. Render 대시보드 → `hrsg-reference-api` → Environment에 비밀값 입력: `LLM_API_KEY`, `ADMIN_PASSWORD`, `RAG_API_KEY`

### 겪은 문제
- 정적 사이트 빌드 실패: `staticPublishPath`는 저장소 루트가 아니라 `rootDir` 기준(`dist`) → Claude가 `render.yaml` 수정
- 무료 백엔드는 15분 미사용 시 잠든다(첫 요청 1분 가까이 소요), 디스크가 유지되지 않는다(체크리스트 상태 초기화)

## 9-2. 논문 검색 Worker (Cloudflare)

Render 무료 플랜(메모리 512MB)에는 임베딩 모델을 올릴 수 없어서 검색만 Cloudflare로 옮긴다.

### 내가 입력한 프롬프트 (앱 폴더에서)
```
관리자모드에서 보니 논문 검색 API는 꺼져 있는데 이건 무슨 뜻이야? … 설명한 후 api연결해줘
Cloudflare api 발급 방법 설명부터 방법 2번으로 진행해줘
```
Claude 안내대로 Cloudflare에서 토큰을 만들어 `hrsg-explorer-rag\.env`에 **직접** 저장한 뒤:
```
저장했어
랜더에 키 넣었어
```

### 결과 요약
- Worker `hrsg-rag-search` (`hrsg-explorer-rag/cloudflare/worker`): Workers AI로 질문 임베딩(bge-m3, Qwen3-0.6B) → Vectorize 인덱스 2개 → 1:1 가중 RRF
- Vectorize: `hrsg-bge-m3`(1,024차원), `hrsg-qwen3-06b-512`(512차원 — 무료 저장 한도 500만 차원 때문)
- 응답 형식이 로컬 RAG API와 같아서 앱은 `RAG_API_URL`·`RAG_API_KEY`만 바꾼다

### 명령 (hrsg-explorer-rag 폴더)
```bash
.venv\Scripts\python scripts\cloudflare_sync.py parity               # 로컬 ↔ Workers AI 벡터 일치(코사인 0.99↑) 확인
.venv\Scripts\python scripts\cloudflare_sync.py upload               # bge 벡터 업로드
.venv\Scripts\python scripts\cloudflare_sync.py upload --model qwen  # qwen 벡터(앞 512차원) 업로드
.venv\Scripts\python scripts\cloudflare_sync.py deploy               # Worker 배포 (RAG_API_KEY 없으면 생성)
.venv\Scripts\python scripts\cloudflare_sync.py query "감온기 분사수 제어 방식"
```

## 비밀값 위치 정리
| 값 | 로컬 | 배포 |
|---|---|---|
| `LLM_API_KEY` | `hrsg-reference-app\.env` | Render → hrsg-reference-api → Environment |
| `ADMIN_PASSWORD` | `hrsg-reference-app\.env` | Render (같은 곳) |
| `RAG_API_KEY` | `hrsg-explorer-rag\.env` | Render (같은 값이어야 함, 다르면 챗 503) + Worker secret |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | `hrsg-explorer-rag\.env` | — |

## 확인할 것
- `https://<백엔드 주소>/api/health`가 JSON을 돌려주는가?
- 정적 사이트 주소에서 홈·계산기·체크리스트가 뜨고, 다른 화면 주소에서 새로고침해도 404가 아닌가?
- 챗 질문 1~2개에 논문 출처가 붙는가? (Claude API 과금)
- `git status`에 `.env`가 보이지 않는가?
