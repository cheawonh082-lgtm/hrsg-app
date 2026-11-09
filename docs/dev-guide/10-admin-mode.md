# 10. 관리자 모드

**목표:** 참고문헌 데이터베이스(논문 목록·서지 정보)를 화면에서 검사·수정하고, 시스템 상태를 한눈에 본다.

## 내가 입력한 프롬프트
```
hrsg 앱에서 관리자 모드를 만들려고 하는데 관리자 모드에 들어가면 좋을 기능들 정리해서 알려줘.
(참고문헌 데이터베이스 관리 기능은 필수로 넣어줘)
```
Claude가 기능 목록을 1차·2차로 나눠 제안하면:
```
1차로 진행해줘
```
비밀번호 관련:
```
readme에 써 있는 관리자모드에 password란이 비어있는데 내가 채워야해?
```
→ 루트 `.env`의 `ADMIN_PASSWORD`와 Render 환경변수에 **직접** 입력한 뒤 "올렸어. 이제 커밋과 푸시 진행해줘."

## 결과 요약 (1차)
- `/admin` 로그인(비밀번호, 세션 시간 제한), 사이드바 하단 "관리자 모드" 링크
- **참고문헌 탭:** 논문 목록, 서지 정보 검사(제목·저자·연도 누락 등 이슈 목록), 서지 편집 → `corpus_all.json`에 저장 후 RAG API 재로딩
- **시스템 상태 탭:** 계산 엔진·LLM·논문 검색 API 연결 상태, 최근 로그

## 파일 위치
```
backend\app\admin\        auth.py, references.py, status.py, logbuffer.py
backend\app\api\admin.py
frontend\src\pages\AdminPage.tsx
frontend\src\components\admin\   AdminLogin, ReferencesPanel, ReferenceEditDialog, IssueList, SystemStatusPanel
.env   ADMIN_PASSWORD, ADMIN_SESSION_HOURS,
       RAG_CORPUS_DIR=../../hrsg-explorer-rag/rag_corpus
       RAG_CORPUS_ALL_PATH=../../hrsg-explorer-rag/data/rag/corpus_all.json
```

## 확인할 것
- 로컬 `/admin` 참고문헌 탭에 논문 목록이 보이는가?
- 배포판에서는 "참고문헌 폴더가 설정되지 않았습니다"가 정상이다. 논문 코퍼스는 공개하지 않으므로 참고문헌 관리는
  **로컬에서만** 하고, 서지를 고친 뒤 `cloudflare_sync.py upload`와 `upload --model qwen`으로 배포판 검색에 반영한다.
