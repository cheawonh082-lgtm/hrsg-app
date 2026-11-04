"""마스킹된 문서를 섹션 단위 청크로 읽는다. 원문(docs_raw)은 여기서 절대 읽지 않는다(PRD §5)."""

import re
from dataclasses import dataclass
from pathlib import Path

from app.guardrails.redactor import Redactor

MOCK_DOCS_DIR = Path(__file__).with_name("mock_docs")
_FRONT_MATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_SECTION = re.compile(r"^##\s+(.+)$", re.MULTILINE)


_PAGE_SUFFIX = re.compile(r"\s*\((pp?\.\s*[\d\s,–-]+)\)\s*$")  # "## 절 제목 (p. 12)" · "(pp. 12–13)"


@dataclass(frozen=True)
class Chunk:
    doc_alias: str  # 내부 식별자(중복 제거용) — 화면 출처 표기는 아래 서지 정보로
    title: str
    section_title: str | None
    text: str
    lang: str | None
    # 서지 정보 (출처 표기: 저자 (연도). 제목. 발행처, p. 쪽)
    authors: tuple[str, ...] = ()
    year: int | None = None
    venue: str | None = None
    pages: str | None = None  # "12", "12–13"
    url: str | None = None


def split_page(section_title: str | None) -> tuple[str | None, str | None]:
    """'운전 사례 (p. 12)' → ('운전 사례', '12')"""
    if not section_title:
        return section_title, None
    m = _PAGE_SUFFIX.search(section_title)
    if not m:
        return section_title, None
    pages = re.sub(r"^pp?\.\s*", "", m.group(1)).strip().replace("-", "–")
    return section_title[: m.start()].strip() or None, pages


def bibliography(meta: dict[str, str], redactor: Redactor) -> dict:
    """앞부분 메타(authors: A; B · year · publisher/venue · url · pages) → Chunk 서지 필드. 저자·발행처도 마스킹한다.
    저자는 세미콜론으로 나눈다 ("Kim, J." 같은 '성, 이름' 표기를 쪼개지 않도록)."""
    authors = tuple(redactor.redact(a.strip()).text for a in meta.get("authors", "").split(";") if a.strip())
    year = meta.get("year", "").strip()
    venue = meta.get("venue") or meta.get("publisher")
    return {
        "authors": authors,
        "year": int(year) if year.isdigit() else None,
        "venue": redactor.redact(venue).text if venue else None,
        "url": meta.get("url") or None,
    }


def resolve_docs_dir(docs_masked_dir: Path) -> tuple[Path, bool]:
    """(사용할 폴더, Mock 여부). 인제스트 결과가 있으면 실제 문서를 쓴다."""
    if docs_masked_dir.is_dir() and any(docs_masked_dir.glob("*.md")):
        return docs_masked_dir, False
    return MOCK_DOCS_DIR, True


def parse_document(raw: str) -> tuple[dict[str, str], str]:
    meta: dict[str, str] = {}
    m = _FRONT_MATTER.match(raw)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                meta[key.strip()] = value.strip()
        raw = raw[m.end():]
    return meta, raw


def split_sections(body: str) -> list[tuple[str | None, str]]:
    matches = list(_SECTION.finditer(body))
    if not matches:
        text = body.strip()
        return [(None, text)] if text else []
    sections: list[tuple[str | None, str]] = []
    lead = body[: matches[0].start()].strip()
    if lead:
        sections.append((None, lead))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        text = body[m.end():end].strip()
        if text:
            sections.append((m.group(1).strip(), text))
    return sections


def load_chunks(docs_dir: Path, redactor: Redactor) -> list[Chunk]:
    """마스킹본이라도 읽을 때 한 번 더 마스킹한다(인제스트 누락 대비 이중 적용)."""
    chunks: list[Chunk] = []
    for path in sorted(docs_dir.glob("*.md")):
        if path.name.lower() == "readme.md":
            continue
        meta, body = parse_document(path.read_text(encoding="utf-8"))
        alias = meta.get("alias")
        if not alias:
            continue  # 별칭 없는 문서는 출처를 표시할 수 없으므로 색인하지 않는다
        title = redactor.redact(meta.get("title", alias)).text
        bib = bibliography(meta, redactor)
        doc_pages = meta.get("pages") or None
        for section_title, text in split_sections(body):
            section_title, pages = split_page(section_title)
            chunks.append(
                Chunk(
                    doc_alias=alias,
                    title=title,
                    section_title=redactor.redact(section_title).text if section_title else None,
                    text=redactor.redact(text).text,
                    lang=meta.get("lang"),
                    pages=pages or doc_pages,
                    **bib,
                )
            )
    return chunks
