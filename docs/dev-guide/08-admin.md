# 8단계. 관리자 모드

## 목표(결과)
- `/admin`에 비밀번호로 로그인(세션 시간 제한). 사이드바 하단에 작은 "관리자 모드" 링크.
- **참고문헌 탭:** 논문 목록, 서지 정보 검사(제목·저자·연도 누락 등 이슈 목록), 서지 편집 → `corpus_all.json`에 저장 후 RAG API 재로딩
- **시스템 상태 탭:** 계산 엔진·LLM·논문 검색 API 연결 상태, 최근 로그
- 참고문헌 관리는 **로컬 전용**(논문 코퍼스 비공개). 배포판에는 "참고문헌 폴더가 설정되지 않았습니다"가 정상이다.
  서지를 고친 뒤에는 `cloudflare_sync.py upload`와 `upload --model qwen`으로 배포판 검색에 반영한다.

```
backend\app\admin\ (auth.py, references.py, status.py, logbuffer.py), backend\app\api\admin.py
frontend\src\pages\AdminPage.tsx, components\admin\ (AdminLogin, ReferencesPanel, ReferenceEditDialog, IssueList, SystemStatusPanel)
.env  ADMIN_PASSWORD, ADMIN_SESSION_HOURS,
      RAG_CORPUS_DIR=../../hrsg-explorer-rag/rag_corpus
      RAG_CORPUS_ALL_PATH=../../hrsg-explorer-rag/data/rag/corpus_all.json
```

## 입력한 프롬프트
```
hrsg 앱에서 관리자 모드를 만들려고 하는데 관리자 모드에 들어가면 좋을 기능들 정리해서 알려줘.(참고문헌 데이터베이스 관리 기능은 필수로 넣어줘)
```
Claude가 기능 목록을 1차·2차로 나눠 제안하면:
```
1차로 진행해줘
```
```
readme에 써 있는 관리자모드에 password란이 비어있는데 내가 채워야해?
```
`.env`와 Render 환경변수에 `ADMIN_PASSWORD`를 **직접** 입력한 뒤:
```
올렸어. 이제 커밋과 푸시 진행해줘.
```

## 사용한 md 파일 위치

| 파일 | 로컬 경로 | GitHub 주소 | 용도 |
|---|---|---|---|
| README.md "관리자 모드 (/admin)" | `C:\Users\chaewon\hrsg-reference-app\README.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/README.md | 로그인·참고문헌 관리 설정 방법 (Claude가 작성) |
| .env.example | `C:\Users\chaewon\hrsg-reference-app\.env.example` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/.env.example | `ADMIN_PASSWORD`, `RAG_CORPUS_DIR`, `RAG_CORPUS_ALL_PATH` 항목 |
| corpus_all.json (md 아님) | `C:\Users\chaewon\hrsg-explorer-rag\data\rag\corpus_all.json` | — (로컬 전용, GitHub 없음) | 관리자 화면이 읽고 고치는 참고문헌 데이터 |

**이 단계 가이드 파일:** `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\08-admin.md` · https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/08-admin.md
