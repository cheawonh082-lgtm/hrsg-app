"""답변 서식 — 출처 번호 [n]·굵게(**)가 숫자 검증을 통과하고, 후속 질문은 따로 블록이 된다."""

from app.chat import answer_format
from app.chat.llm.base import ComposeContext
from app.chat.llm.prompts import compose_content
from app.domain.models.chat import Citation
from app.guardrails.number_validator import check_numbers

DRAFT = """**핀치 포인트를 낮추면** 증기 생산이 늘어납니다. [1]

## 1. 원리

- **열회수:** 배기가스에서 더 많은 열을 회수합니다. [1, 2]
- **비용:** 증발기 면적이 커집니다. [7]

<followups>
- 접근 온도와 차이는?
2. 최적 핀치 포인트는?
</followups>"""


def test_citation_markers_and_bold_survive_number_check():
    protected = answer_format.protect(DRAFT, n_sources=2)
    checked = check_numbers(protected.text, "ko", allowed_literals=set())
    assert not checked.formula_blocked  # ** 를 거듭제곱으로 보지 않는다
    assert checked.status != "sanitized"
    body, questions = answer_format.split_followups(answer_format.restore(checked.text, protected))
    assert body.startswith("**핀치 포인트를 낮추면** 증기 생산이 늘어납니다. [1]")
    assert "[1,2]" in body
    assert "[7]" not in body and "커집니다." in body  # 넘긴 발췌(2개) 밖의 번호는 지운다
    assert "<followups>" not in body
    assert questions == ["접근 온도와 차이는?", "최적 핀치 포인트는?"]


def test_unsupported_number_is_still_removed():
    protected = answer_format.protect("손실은 12.3 MW입니다. [1]", n_sources=1)
    checked = check_numbers(protected.text, "ko", allowed_literals=set())
    assert checked.status == "sanitized" and "12.3" not in checked.text
    assert answer_format.restore(checked.text, protected).endswith("[1]")


def test_documents_are_numbered_in_citation_order():
    cites = [Citation(doc_alias=a, snippet="s", score=1.0) for a in ("DOC-A", "DOC-B")]
    content = compose_content(ComposeContext(message="q", locale="ko", intent="knowledge", citations=cites))
    assert content.index('<document id="1" alias="DOC-A"') < content.index('<document id="2" alias="DOC-B"')


def test_chat_returns_markdown_with_citations_and_follow_ups(client):
    body = client.post("/api/chat", json={"sessionId": "s", "message": "HRSG 핀 오염이 GT 배압에 미치는 영향은?"}).json()
    kinds = [b["type"] for b in body["blocks"]]
    assert kinds[-1] == "follow_ups" and kinds.index("text") < kinds.index("citations")
    text = next(b["markdown"] for b in body["blocks"] if b["type"] == "text")
    n = len(next(b for b in body["blocks"] if b["type"] == "citations")["items"])
    assert text.startswith("**") and "[1]" in text
    assert all(1 <= int(x) <= n for x in answer_format.CITE_RE.findall(text) for x in x.split(","))
    assert len(body["blocks"][-1]["items"]) == 3
