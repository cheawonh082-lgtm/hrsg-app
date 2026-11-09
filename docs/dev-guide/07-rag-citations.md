# 7단계. 논문 RAG 검색 · 임베딩 모델 + 챗 출처 표기·답변 형식

## 목표(결과)

### 논문 RAG 검색 (별도 저장소 `hrsg-explorer-rag`)
- 챗이 예시 문서 대신 **논문 41편(문단 3,095개)**에서 근거 문단을 찾는다. 한국어 질문으로 영어 논문 문단도 찾는다.
- **최종 임베딩 모델: BAAI bge-m3 + Qwen3-Embedding-0.6B, 두 검색 결과를 1:1 가중 RRF로 결합 (한국어·영어 질문 모두 같은 구성)**
  - 각 검색기에서 상위 50개 → RRF(k=60) → 최종 결과. 한국어 질문은 한↔영 용어 사전의 영어 용어를 덧붙여 검색
  - 배포판(Cloudflare)은 무료 저장 한도 때문에 Qwen3 벡터를 앞 512차원만 쓴다
  - 평가셋 v1 dev(k=8) 결과: 한국어 recall@8 **0.949** · MRR **0.863**, 영어 recall@8 **0.974** · MRR **0.864**
    (협업안의 BM25 기준선: 한국어 0.57 / 0.46)
- 로컬 RAG API(`http://127.0.0.1:8100`)를 앱에 연결: `.env`에 `RAG_RETRIEVER=api`, `RAG_API_URL`, `RAG_API_METHOD=4`

```
C:\Users\<사용자>\hrsg-explorer-rag\
├─ rag_corpus\R001.json … R041.json   논문 정리본 (사람이 넣음, Git 제외 — 유료 논문은 요약본만)
├─ hrsg_eval_set_v1\                  평가셋 v1 (사람이 넣음)
├─ api\app.py, rag\, scripts\         RAG API(포트 8100), 검색 엔진, 인덱스·평가 스크립트
└─ data\rag\corpus_all.json, index\   생성물 (Git 제외)
```

### 챗 출처 표기·답변 형식
- ChatGPT처럼 읽기 쉬운 답변(마크다운 제목·목록·굵게), 문단 끝 출처 칩, 답변 아래 "출처 n" 버튼, 후속 질문 추천 3개
- 출처: 첫 줄은 논문 첫 장 제목, 아랫줄은 저자·연도·발행처·쪽수. 본문에서 실제 인용한 문서만 표시
- 자료에 없는 내용은 AI 일반 지식으로 보충하고 `[AI]` 출처로 구분

```
backend\app\chat\answer_format.py, chat\llm\prompts.py, guardrails\number_validator.py, rag\remote.py
frontend\src\components\chat\ (Markdown.tsx, CitationList.tsx, MessageBubble.tsx), src\lib\citation.ts
```

## 입력한 프롬프트

### 7-1. 정리본 읽고 계획 (VS Code에서 `hrsg-explorer-rag` 폴더를 열고)
```
C:\Users\chaewon\hrsg-explorer-rag\rag_corpus에 RAG에 사용할 문헌들과 md파일을 넣어두었어. 해당 폴더 위치에 있는 md파일들을 모두 읽고 계획을 작성해줘.
```

### 7-2. RAG API 만들기
```
C:\Users\chaewon\hrsg-explorer-rag\rag_corpus 새로운 문헌 파일들 넣어놨어.
RAG API를 만들어 줘.

[입력 데이터]
- corpus_all.json: {"documents":[...], "paragraphs":[...]}
- paragraphs 필드: id, doc_id, section, page_start, page_end, text, terms, content_type(text|table|equation|caption), source_type(verbatim|paraphrase)
- 문단 약 3,100개. 한국어(ko)와 영어(en)가 섞여 있고, 언어는 documents[].lang에 있음

[인덱스 구축]
1. bge_index: BAAI/bge-m3 dense 임베딩. 정규화한 뒤 코사인 유사도로 검색
2. qwen_index: Qwen/Qwen3-Embedding(모델 크기는 설정값, 기본 0.6B). 질의에는 instruction 프롬프트를 붙이고 문서에는 붙이지 않음
3. BM25: 검색 대상 = section + text + terms
   - 한국어는 형태소 분석기(kiwipiepy 등), 영어는 소문자화 후 토큰화
   - 규격·약어·단위(IF97, HP/IP/LP, kJ/kg, CO2 등)가 잘게 쪼개지지 않게 처리
- 임베딩 입력: "[section] text"
[검색 방식 4가지] (각 검색기 top_k=50, 최종 결과 top_n 기본 5)
- 1안: bge_index + BM25 → RRF
- 2안: qwen_index + BM25 → RRF
- 3안: bge_index + qwen_index + BM25 → RRF
- 4안: 3안과 같은 검색기 → 질문 언어별 가중 RRF
  - 질문 언어 판별: 한글 비율 등
```
이어서:
```
한국어질문과 영어질문에 대한 평가를 분리하여 작성해줘.
git에 올려줘.
llm으로 답변을 만들어서 질문자의 챗에 논리적인 답변을 하는 결과물이 필요해. 답변의 출처로 논문명만 간단하게 표기해줘.
```

> **Claude의 선택형 질문** (위 프롬프트에 대해)
>
> | 질문 | 선택지 | 선택 |
> |---|---|---|
> | 새 코퍼스용 평가 질문이 없습니다. 한국어/영어 분리 평가는 어떤 질문으로 할까요? | 제가 질문셋 작성 (Recommended) / 직접 질문셋 제공 | **제가 질문셋 작성** |
> | Git에는 어디로 올릴까요? (원격 저장소 없음) | 원격 URL 알려줌 / 로컬 커밋만 | **로컬 커밋만** |
> | rag_corpus(문헌 정리본)도 Git에 올릴까요? | 올리지 않음 (Recommended) / 함께 올림 | **올리지 않음** |
> | LLM 답변은 어디에 붙일까요? | 앱 챗에 연결 (Recommended) / RAG API에 /answer 추가 / 둘 다 | **앱 챗에 연결** |

### 7-3. 평가셋으로 최종 구성 정하기 (`hrsg_eval_set_v1` 폴더를 넣은 뒤)
```
hrsg_eval_set_v1폴더 안에 md 파일들을 모두 읽어. 그 내용대로 실행해줘.
```
```
해당 4안의 모델 3개의 조합을 가중치를 각각 다르게 준 후 조합들을 만들어서 그들의 평가셋 결과를 hrsg_eval_set_v1 폴더 참고해 도표로 만들어 알려줘.
```
```
두 언어 모두 1:1:0 비율로 맞추는 개선안 채택해서 임배딩 모델 바꿔줘. 배포판에서도 해당 4안 조합 비율로 바꿔줘.
```
```
다음 임베딩 모델로 교체하고 커밋, 푸시해줘. 해당 이미지가 최종 확정 임베딩 모델이야. 수정 확인 후에 해당 내용을 개발 가이드에 반영하여 다시 올려줘
```

> **Claude의 선택형 질문** (팀 확정안 이미지의 영어 「Qwen3 단독」 수치가 재현되지 않을 때)
>
> | 질문 | 선택지 | 선택 |
> |---|---|---|
> | 영어 Qwen3 단독 수치가 우리 평가에서 재현되지 않습니다(현재 bge-m3+Qwen3 1:1보다 네 지표 모두 낮음). 어떻게 진행할까요? | 그대로 적용 / 현재 구성 유지 / 설정 확인 후 재현 | 직접 입력: **"qwen3 1024차원이야. 확인 후 가능하면 적용해줘"** |
>
> → 1024차원으로도 현재 구성보다 낮게 나와 **bge-m3 + Qwen3 1:1(두 언어 모두)을 최종 구성으로 유지**했다(`eval/v1/FINAL_DECISION.md`).

### 7-4. 챗 출처 표기·답변 형식 (앱 폴더에서)
```
https://chatgpt.com/s/t_6ae9ee4e14348191abebf9b2e71cb382
ai챗봇 ui를 다음 링크의 형식으로 만들어줘. 출처표기방식, 출력된 텍스트 형식 등을 참고해줘.
```
```
수정 사항 적용해줘.
1. 자료에 없는 질문은 "확인되지 않습니다"로 끝낼지, 일반 지식으로 보충 설명할지 정해 주세요. --> api 활용하여 ai생성 답변으로 보충 설명해줘. 이 때는 출처표기 명시해.
2. 내부 문서 기반으로 답변 생성 시 현재는 별칭으로 출처가 표기되는데 논문명, 페이지 쪽수 등 보편적인 출처표기 방식으로 별칭을 대체하도록 수정해줘.
3. api 모델을 클로드로 바꿔줘. 클로드 api키가 있으니 모델 바꿀 때 요청해줘.
```
```
api 질문챗봇을 테스트해보니 출처에 인용문서에 제목 대신 다른 텍스트가 뜨는 것 같아. 인용 문서의 제목은 첫 장의 제목 텍스트로 출처 표시가 나오도록 해줘. 제목이 json파일에 들어있지 않다면 추가하는 작업도 출처표시를 위해 필요하다면 실행해.
```

## 사용한 md 파일 위치

| 파일 | 로컬 경로 | GitHub 주소 | 용도 |
|---|---|---|---|
| 협업안 (PDF) | 채팅에 첨부 | — | 「HRSG Explorer AI 채팅 검색 개선 협업안」(261021) — 검색 개선 범위·평가 기준 |
| rag_corpus 정리본 | `C:\Users\chaewon\hrsg-explorer-rag\rag_corpus` | — (로컬 전용, GitHub 없음) | 논문 정리본과 설명 md (7-1에서 Claude가 읽음, Git 제외) |
| README.md (평가셋) | `C:\Users\chaewon\hrsg-explorer-rag\hrsg_eval_set_v1\README.md` | — (로컬 전용, GitHub 없음) | 평가셋 구성, 지표(recall@8·hit@8·MRR·page@8), 실행 방법, 기준 점수 |
| CLAUDE.md (평가셋) | `C:\Users\chaewon\hrsg-explorer-rag\hrsg_eval_set_v1\CLAUDE.md` | — (로컬 전용, GitHub 없음) | 평가 작업 규칙 (튜닝은 dev로만, test는 확정 후 1회, 자료 외부 반출 금지) |
| eval_prompt_ko_en.md | `C:\Users\chaewon\hrsg-explorer-rag\hrsg_eval_set_v1\eval_prompt_ko_en.md` | — (로컬 전용, GitHub 없음) | 한국어·영어 분리 평가를 실행하는 프롬프트 (Claude Code에 붙여 넣어 사용) |
| README.md (RAG) | `C:\Users\chaewon\hrsg-explorer-rag\README.md` | — (로컬 전용, GitHub 없음) | RAG API 실행·검색 방식·Cloudflare 배포 (Claude가 작성) |
| RESULTS.md | `C:\Users\chaewon\hrsg-explorer-rag\eval\RESULTS.md` | — (로컬 전용, GitHub 없음) | 평가 결과 (Claude가 작성) |
| FINAL_DECISION.md | `C:\Users\chaewon\hrsg-explorer-rag\eval\v1\FINAL_DECISION.md` | — (로컬 전용, GitHub 없음) | 최종 임베딩 구성 결정 기록 (Claude가 작성) |
| README.md "실제 문서 넣기" | `C:\Users\chaewon\hrsg-reference-app\README.md` | https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/README.md | 앱에서 RAG API 연결 방법 |

**이 단계 가이드 파일:** `C:\Users\chaewon\hrsg-reference-app\docs\dev-guide\07-rag-citations.md` · https://github.com/cheawonh082-lgtm/hrsg-app/blob/main/docs/dev-guide/07-rag-citations.md
