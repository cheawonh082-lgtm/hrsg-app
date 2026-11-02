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
`.env`(Gemini 키), `data/checklist_state.json`, `node_modules/` 등은 `.gitignore`로 빠진다. push 전에 `git status`로 확인한다.

## 3. Render에 Blueprint로 만들기

1. dashboard.render.com → **New +** → **Blueprint**
2. **Connect GitHub** → 저장소 접근 권한에서 `hrsg-app`만 선택해 허용
3. 저장소를 고르면 `render.yaml`의 서비스 2개가 보인다. Blueprint 이름을 넣는다
4. `LLM_API_KEY` 입력란에 Gemini API 키를 넣는다 (Render에만 저장, Git에는 없음)
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
- 챗에 질문 1개 (Gemini 무료 한도를 아끼기 위해 1~2개만)
- 다른 화면 주소에서 새로고침해도 404가 아닌지

## 무료 플랜에서 알아 둘 점

- **잠들기**: 백엔드는 15분 동안 요청이 없으면 잠든다. 다음 첫 요청은 깨어나는 데 1분 가까이 걸려 첫 화면 로딩이 실패할 수 있다 → 잠시 뒤 새로고침.
- **저장 안 됨**: 무료 웹 서비스는 디스크가 유지되지 않는다. 체크리스트 체크 상태·메모는 재시작·재배포·잠들기 후 초기화된다.
- **Gemini 한도**: 공개 주소라 누구나 챗을 쓰면 무료 한도(모델당 하루 약 20회)가 빨리 닳는다. 키 없이 띄우려면 Render 환경변수 `LLM_PROVIDER=fake`.
- **논문 RAG 검색 없음**: 논문 RAG 서버(`RAG_RETRIEVER=api`, hrsg-explorer-rag)는 임베딩 모델 때문에 메모리 512MB로 돌릴 수 없고, 논문 발췌 코퍼스는 공개하지 않으므로 배포판 챗은 내장 문서 키워드 검색(`keyword`)을 쓴다.
- **월 사용량**: 무료 웹 서비스는 계정당 월 750시간까지 켜져 있을 수 있다 (서비스 1개면 충분).

## 수정 후 다시 배포

`main`에 push 하면 두 서비스가 자동으로 다시 빌드·배포된다. 환경변수는 Render 서비스 화면 → **Environment**에서 바꾼다.
