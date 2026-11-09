# 7. 논문 RAG 검색 + 임베딩 모델 선정 (별도 저장소 hrsg-explorer-rag)

**목표:** 챗이 예시 문서 대신 **논문 40여 편**에서 근거 문단을 찾는다. 한국어 질문으로 영어 논문 문단도 찾도록 다국어 벡터 검색을 쓰고,
평가셋으로 검색 방식을 비교해 고른다. 기준 문서: 「HRSG Explorer AI 채팅 검색 개선 협업안」(261021).

이 작업은 앱과 **다른 폴더**에서 한다. VS Code에서 `C:\Users\<사용자>\hrsg-explorer-rag`를 따로 열고 진행한다.

## 준비물과 위치

```
C:\Users\<사용자>\hrsg-explorer-rag\
├─ rag_corpus\R001.json … R041.json   논문 정리본(문단·서지). 사람이 넣는다. Git 제외(저작권)
├─ hrsg_eval_set_v1\                  평가셋 v1 (README.md, CLAUDE.md, App\tools\eval_questions.json …)
├─ .env                               CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, RAG_API_KEY (Git 제외)
└─ (Claude가 만든다) rag\, api\, scripts\, cloudflare\worker\, eval\, index\, data\rag\corpus_all.json
```

- 논문 PDF 원문은 넣지 않는다. 유료 논문은 요약(paraphrase) 정리본만 (`source_type: paraphrase`).
- 평가셋 폴더의 `CLAUDE.md` 규칙(튜닝은 dev로만, test는 확정 후 1회, 채점 스크립트 지표만 사용)을 따른다.

## 내가 입력한 프롬프트 (순서대로)

① 정리본 읽고 계획
```
C:\Users\chaewon\hrsg-explorer-rag\rag_corpus에 RAG에 사용할 문헌들과 md파일을 넣어두었어.
해당 폴더 위치에 있는 md파일들을 모두 읽고 계획을 작성해줘.
```

② RAG API 만들기 — 원문: [prompts/07-rag-api.md](prompts/07-rag-api.md)
```
C:\Users\chaewon\hrsg-explorer-rag\rag_corpus 새로운 문헌 파일들 넣어놨어.
RAG API를 만들어 줘.
[입력 데이터] corpus_all.json …  [인덱스 구축] bge_index / qwen_index / BM25 …
[검색 방식 4가지] 1안 bge+BM25, 2안 qwen+BM25, 3안 bge+qwen+BM25, 4안 질문 언어별 가중 RRF
```

③ 평가셋 적용
```
hrsg_eval_set_v1폴더 안에 md 파일들을 모두 읽어. 그 내용대로 실행해줘.
```

④ 가중치 비교 → 채택
```
해당 4안의 모델 3개의 조합을 가중치를 각각 다르게 준 후 조합들을 만들어서
그들의 평가셋 결과를 hrsg_eval_set_v1 폴더 참고해 도표로 만들어 알려줘.
```
```
두 언어 모두 1:1:0 비율로 맞추는 개선안 채택해서 임배딩 모델 바꿔줘. 배포판에서도 해당 4안 조합 비율로 바꿔줘.
```

⑤ 앱에 연결 (앱 폴더에서)
```
관리자모드에서 보니 논문 검색 API는 꺼져 있는데 이건 무슨 뜻이야? 챗봇에 검색할 때 rag가 돌아가지 않는다는 거야? 설명한 후 api연결해줘
```

## 결과 요약
- 검색기 3개(각 상위 50개): `bge`(BAAI/bge-m3, 1,024차원), `qwen`(Qwen3-Embedding-0.6B), `bm25`(kiwipiepy 형태소, IF97·HP/IP/LP 같은 규격어 보호)
- 방식 1~4안, **최종 채택 = 4안 bge:qwen:BM25 = 1:1:0 (두 언어 모두)** — 평가셋 v1 dev에서 가중치 91개 조합 비교
- 한국어 질문은 한↔영 용어 사전으로 영어 용어를 덧붙여 검색
- 평가셋 v1 dev 결과(k=8):

| 구성 | 언어 | recall@8 | MRR |
|---|---|---|---|
| BM25 기준선 (협업안) | 전체 | 0.73 | 0.63 |
| BM25 기준선 (협업안) | 한국어 | 0.57 | 0.46 |
| 4안 1:1:0 (Qwen 512차원, 현재 배포) | 한국어 | 0.949 | 0.863 |
| 4안 1:1:0 (Qwen 512차원, 현재 배포) | 영어 | 0.974 | 0.864 |

## 실행 명령 (hrsg-explorer-rag 폴더)
```bash
.venv\Scripts\python -m pip install -r requirements-api.txt
.venv\Scripts\python scripts\build_rag_index.py --src rag_corpus     # 병합 + 인덱스 (CPU 기준 모델당 2~3시간, 끊겨도 이어서 계산)
.venv\Scripts\python -m uvicorn api.app:app --port 8100                # 로컬 RAG API
```
앱 쪽 연결 (`hrsg-reference-app\.env`):
```
RAG_RETRIEVER=api
RAG_API_URL=http://127.0.0.1:8100
RAG_API_METHOD=4
```

## 주요 파일 (hrsg-explorer-rag)
| 파일 | 역할 |
|---|---|
| `scripts/build_rag_index.py` | `rag_corpus/R???.json` → `data/rag/corpus_all.json` → `index/rag/...` |
| `api/app.py` | RAG API (`POST /search`, `/search/compare`, `/health`) |
| `rag/hybrid_search.py`, `rag/bm25.py`, `rag/glossary.py` | 결합(RRF), BM25, 한↔영 용어 확장 |
| `scripts/eval_v1_run.py` | 평가셋 v1에 1~4안 실행 → 채점은 평가셋 스크립트 |
| `eval/RESULTS.md`, `eval/v1/FINAL_DECISION.md` | 평가 결과, 최종 구성 결정 기록 |

## 확인할 것
- 튜닝은 dev로만 했는가? test 30문항은 구성을 확정한 뒤 **한 번만** 돌려 최종 성능으로 보고한다 (현재 미실시 — 남은 과제)
- 협업안 대비 남은 과제: 배포판에 BM25 결합(현재 가중치 0), 문헌당 최대 2문단 → 최종 8개 규칙(현재 배포판 5개·제한 없음),
  답 없는 6문항 관찰 기록
- `rag_corpus/`, `.env`, `index/`가 Git에 올라가지 않는가? (`.gitignore`)
