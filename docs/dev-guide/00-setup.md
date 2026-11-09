# 0단계. 도구 설치와 폴더 만들기

## 목표(결과)
- 개발 도구가 설치되고, 두 저장소 폴더가 나란히 준비된다.
- Claude Code가 이후 모든 답변·설명·코드 주석을 한국어로 쓴다.

| 도구 | 버전 | 용도 |
|---|---|---|
| VS Code + Claude Code 확장 | 최신 | 모든 작업을 Claude Code 채팅으로 진행 |
| Python | 3.11 이상 | 백엔드(FastAPI), RAG 검색 |
| Node.js | 20 이상 | 프론트엔드(Vite + React) |
| Git | 최신 | 버전 관리, GitHub 업로드 |
| Chrome | 최신 | Playwright E2E 테스트 |

```
C:\Users\<사용자>\
├─ hrsg-reference-app\     ← 웹 앱. VS Code에서 이 폴더를 열고 Claude Code 패널에서 작업
└─ hrsg-explorer-rag\      ← 논문 RAG 검색 (7단계)
```

## 입력한 프롬프트
```
모든 답변과 설명, 코드 주석은 반드시 한국어로 작성해 주세요.
```
설치가 필요하면: `Node.js와 Git이 설치되어 있는지 확인하고 없으면 설치 명령을 알려줘.`

## 사용한 md 파일 위치

| 파일 | 로컬 경로 | GitHub 주소 | 용도 |
|---|---|---|---|
| (없음) | — | — | 설치·폴더 준비만 한다. 한국어 답변 선호는 Claude 메모리에 저장된다 |

**이 단계 가이드 파일:** `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\00-setup.md` · https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/00-setup.md
