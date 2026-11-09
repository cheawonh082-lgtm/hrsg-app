# 9단계. 배포 (Render + Cloudflare)

## 목표(결과)
누구나 주소로 접속하는 배포판. 화면·백엔드는 Render 무료 플랜, 논문 검색은 Cloudflare.

| 구성 | 서비스 | 내용 |
|---|---|---|
| 화면 | Render 정적 사이트 `hrsg-reference-web` — https://hrsg-reference-web.onrender.com | React 빌드 결과(`frontend/dist`). `/api/*` 요청은 백엔드로 넘김(CORS 설정 불필요) |
| 백엔드 | Render 웹 서비스 `hrsg-reference-api` — https://hrsg-reference-api.onrender.com | FastAPI. 계산 키트, Claude LLM, 가드레일 |
| 논문 검색 | Cloudflare Worker `hrsg-rag-search` | Workers AI로 질문 임베딩(bge-m3, Qwen3-Embedding-0.6B) → Vectorize 인덱스 2개(`hrsg-bge-m3` 1,024차원, `hrsg-qwen3-06b-512` 512차원) → 1:1 가중 RRF. 응답 형식이 로컬 RAG API와 같다 |

- `main` 브랜치에 push하면 Render 두 서비스가 자동으로 다시 배포된다.
- 비밀값 위치

| 값 | 로컬 | 배포 |
|---|---|---|
| `LLM_API_KEY`, `ADMIN_PASSWORD` | `hrsg-reference-app\.env` | Render → hrsg-reference-api → Environment |
| `RAG_API_KEY` | `hrsg-explorer-rag\.env` | Render(같은 값) + Worker secret |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | `hrsg-explorer-rag\.env` | — |

- 무료 플랜 특성: 백엔드는 15분 미사용 시 잠든다(첫 요청 1분 가까이). 디스크가 유지되지 않아 체크리스트 상태는 재시작 시 초기화.
  챗 대화 기록은 브라우저에 저장되므로 영향 없음.

## 입력한 프롬프트

### 9-1. GitHub + Render
```
이제 이 웹앱을 Render로 배포하고 싶은데 github리포지토리 생성하고 올리는 것부터 시작해서 배포에 필요한 파일들을 생성하고 절차 안내해줘, github와 render계정은 새로 만들어 두었어. 참고로 모두 무료 plan을 사용할거야.
```
사람이 GitHub 저장소·Render Blueprint를 만든 뒤 진행 상황을 알린다:
```
다른 계정으로 생성했어. https://github.com/cheawonh082-lgtm/hrsg-app.git
blueprint만들었어
완료했어
```

### 9-2. 논문 검색 Cloudflare 연결
```
관리자모드에서 보니 논문 검색 API는 꺼져 있는데 이건 무슨 뜻이야? 챗봇에 검색할 때 rag가 돌아가지 않는다는 거야? 설명한 후 api연결해줘
```

> **Claude의 선택형 질문**
>
> | 질문 | 선택지 | 선택 |
> |---|---|---|
> | 논문 검색 API를 어디에 연결할까요? (배포판은 예시 문서 7건만 검색, 논문 RAG 서버는 이 PC에서만 동작) | 로컬에서만 연결 (Recommended) / 배포판: Cloudflare 경량 RAG / 배포판: 유료 서버에 RAG 그대로 | 직접 입력: "방법 2번으로 진행 시 api 토큰은 현재 쓰고 있는 클로드 api를 말하는건지 설명해줘. 추가적으로 필요한 유료서비스가 있는지도 확인해줘." → 설명을 듣고 **방법 2(Cloudflare)** 선택 |

```
Cloudflare api 발급 방법 설명부터 방법 2번으로 진행해줘
```
Cloudflare 토큰을 `hrsg-explorer-rag\.env`에, `RAG_API_KEY`를 Render에 **직접** 넣은 뒤:
```
저장했어
랜더에 키 넣었어
```

### 9-3. 이후 배포
```
커밋하고 GitHub에 푸시해서 Render에 배포
```

## 사용한 md 파일 위치

| 파일 | 로컬 경로 | GitHub 주소 | 용도 |
|---|---|---|---|
| DEPLOY.md | `C:\Users\chaewon\hrsg-reference-app\DEPLOY.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/DEPLOY.md | GitHub 저장소 → Render Blueprint → 환경변수 → 확인 절차, 무료 플랜 주의점 (Claude가 작성) |
| render.yaml (md 아님) | `C:\Users\chaewon\hrsg-reference-app\render.yaml` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/render.yaml | Render 서비스 2개 정의 (Blueprint 파일) |
| README.md "Cloudflare 배포" (RAG) | `C:\Users\chaewon\hrsg-explorer-rag\README.md` | — (로컬 전용, GitHub 없음) | Worker·Vectorize 구성, 자격 증명, `cloudflare_sync.py` 명령 순서 |

**이 단계 가이드 파일:** `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\09-deploy.md` · https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/09-deploy.md
