# 0. 준비 — 도구 설치와 폴더

## 설치할 것

| 도구 | 버전 | 용도 |
|---|---|---|
| VS Code + Claude Code 확장 | 최신 | 모든 작업을 Claude Code 채팅으로 진행 |
| Python | 3.11 이상 | 백엔드(FastAPI), RAG 검색 |
| Node.js | 20 이상 | 프론트엔드(Vite + React) |
| Git | 최신 | 버전 관리, GitHub 업로드 |
| Chrome | 최신 | Playwright E2E 테스트 (설치된 Chrome 사용) |

설치는 Claude에게 맡겨도 된다. 예: "Node.js와 Git이 설치되어 있는지 확인하고 없으면 설치 명령을 알려줘."

## 폴더 만들기

```
C:\Users\<사용자>\
├─ hrsg-reference-app\     ← 웹 앱. VS Code에서 이 폴더를 연다
└─ hrsg-explorer-rag\      ← 논문 RAG 검색 (7단계에서 만든다)
```

VS Code에서 `hrsg-reference-app` 폴더를 열고 Claude Code 패널을 연다. 이후 프롬프트는 모두 이 패널에 입력한다.

## 첫 프롬프트 — 답변 언어 고정

```
모든 답변과 설명, 코드 주석은 반드시 한국어로 작성해 주세요.
```

Claude가 이 선호를 메모리에 저장해 이후 세션에서도 한국어로 답한다.

## 확인할 것
- `python --version`, `node --version`, `git --version`이 모두 나오는가?
- VS Code가 연 폴더가 `hrsg-reference-app`인가? (Claude Code는 연 폴더를 작업 폴더로 쓴다)
