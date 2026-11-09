# 프롬프트 원문: 7단계 — RAG API 만들기 (hrsg-explorer-rag 폴더에서)

실제로 입력한 프롬프트 그대로다. 아래 줄부터 끝까지 복사해 Claude Code에 붙여 넣는다. 설명: [07-rag-search.md](../07-rag-search.md)

---

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
