# Render 배포 (무료 플랜)

GitHub 저장소 → Render Blueprint(`render.yaml`)로 서비스 2개를 만든다.

| 서비스 | 종류 | 역할 |
|---|---|---|
| `hrsg-reference-api` | Python 웹 서비스 (free) | FastAPI 백엔드 (`backend/`) |
| `hrsg-reference-web` | 정적 사이트 | React 프론트엔드 (`frontend/dist`). `/api/*` 요청은 백엔드로 rewrite |

브라우저는 정적 사이트 주소 하나만 쓰므로 CORS 설정이나 앱 코드 수정이 필요 없다.

## 1. GitHub 저장소 만들기

1. github.com → 오른쪽 위 **+** → **New repository**
2. Repository name: `hrsg-app`, **Private** 권장 (PRD 등 내부 문서 포함)
3. README·.gitignore·license는 **추가하지 않는다** (빈 저장소여야 그대로 push 된다)
4. **Create repository** → 나오는 HTTPS 주소(`https://github.com/cheawonh082-lgtm/hrsg-app.git`)를 복사

## 2. 코드 올리기

```bash
git remote add origin https://github.com/cheawonh082-lgtm/hrsg-app.git
git push -u origin main
```

처음 push 하면 브라우저에서 GitHub 로그인(Git Credential Manager) 창이 뜬다.
`.env`(LLM API 키), `data/checklist_state.json`, `node_modules/` 등은 `.gitignore`로 빠진다. push 전에 `git status`로 확인한다.

## 3. Render에 Blueprint로 만들기

1. dashboard.render.com → **New +** → **Blueprint**
2. **Connect GitHub** → 저장소 접근 권한에서 `hrsg-app`만 선택해 허용
3. 저장소를 고르면 `render.yaml`의 서비스 2개가 보인다. Blueprint 이름을 넣는다
4. `LLM_API_KEY` 입력란에 Anthropic(Claude) API 키를 넣는다 (Render에만 저장, Git에는 없음). 이미 만든 서비스라면 `hrsg-reference-api` → **Environment**에서 값을 바꾼다
5. **Apply** → 백엔드(약 2~3분)와 정적 사이트(약 1~2분)가 빌드된다

## 4. 백엔드 주소 확인 (중요)

Render 서비스 이름이 이미 쓰이고 있으면 주소 뒤에 문자가 붙는다 (예: `hrsg-reference-api-x1y2.onrender.com`).

1. `hrsg-reference-api` 서비스 화면 위쪽의 주소를 확인
2. `https://<그 주소>/api/health` 를 열어 JSON이 나오면 백엔드 정상
3. 주소가 `hrsg-reference-api.onrender.com`이 아니면 `render.yaml`의 rewrite `destination`을 실제 주소로 고쳐 commit·push
   (Blueprint가 자동으로 다시 적용한다)

## 5. 확인

정적 사이트 주소(`https://hrsg-reference-web.onrender.com` 등)를 열어

- 홈·계산기·체크리스트 화면이 뜨는지
- 챗에 질문 1~2개 (Claude API는 사용량만큼 과금)
- 다른 화면 주소에서 새로고침해도 404가 아닌지

## 무료 플랜에서 알아 둘 점

- **잠들기**: 백엔드는 15분 동안 요청이 없으면 잠든다. 다음 첫 요청은 깨어나는 데 1분 가까이 걸려 첫 화면 로딩이 실패할 수 있다 → 잠시 뒤 새로고침.
- **저장 안 됨**: 무료 웹 서비스는 디스크가 유지되지 않는다. 체크리스트 체크 상태·메모는 재시작·재배포·잠들기 후 초기화된다.
- **LLM 비용**: 챗은 Claude API(`claude-sonnet-5-5`)를 쓰며 사용량만큼 과금된다. 공개 주소라 누구나 챗을 쓸 수 있으므로 Anthropic 콘솔에서 월 사용 한도를 걸어 두는 것이 좋다. 키 없이 띄우려면 Render 환경변수 `LLM_PROVIDER=fake`.
- **논문 검색은 Cloudflare Worker**: 로컬 논문 RAG 서버는 임베딩 모델 때문에 메모리 512MB로 돌릴 수 없다. 그래서 배포판은 같은 응답 형식의 Cloudflare Worker를 쓴다.
  - 구성: `https://hrsg-rag-search.auroora0802.workers.dev`, Workers AI bge-m3 · Qwen3-Embedding 0.6B + 비공개 Vectorize 인덱스 2개(`hrsg-bge-m3` 1,024차원, `hrsg-qwen3-06b-512` 512차원). 배포는 hrsg-explorer-rag의 `scripts/cloudflare_sync.py`(README "Cloudflare 배포")로 한다.
  - 설정: `RAG_RETRIEVER=api`, `RAG_API_URL`은 Worker 주소. `RAG_API_KEY`는 Render 화면에서 넣고, hrsg-explorer-rag `.env`의 값과 같아야 한다(다르면 챗이 503).
  - 검색 방식은 로컬 4안과 같은 bge:qwen:BM25 = 1:1:0(두 언어 모두, 평가셋 v1 dev 91개 조합 비교로 결정)이다. BM25는 가중치 0이라 쓰지 않는다. qwen은 무료 플랜 저장 한도(500만 차원) 때문에 MRL 512차원이다. 서지 정보를 고치면 `cloudflare_sync.py upload`와 `upload --model qwen`으로 두 인덱스의 메타데이터를 다시 올린다.
- **월 사용량**: 무료 웹 서비스는 계정당 월 750시간까지 켜져 있을 수 있다 (서비스 1개면 충분).

## 수정 후 다시 배포

`main`에 push 하면 두 서비스가 자동으로 다시 빌드·배포된다. 환경변수는 Render 서비스 화면 → **Environment**에서 바꾼다.
