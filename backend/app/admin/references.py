"""참고문헌 데이터베이스(논문 RAG 코퍼스) 관리 — hrsg-explorer-rag의 문헌 JSON을 읽고 서지 정보를 고친다.

RAG_CORPUS_DIR       문헌별 R???.json({"document", "paragraphs", "report"})과 *mapping*.json이 있는 폴더
RAG_CORPUS_ALL_PATH  검색 API가 읽는 corpus_all.json — 주면 서지 정보를 고칠 때 함께 고친다

서지 정보(제목·저자·연도·발행처·DOI·URL·언어)는 검색 색인(임베딩·BM25)에 들어가지 않으므로 재색인 없이 반영된다.
문단 본문은 여기서 고치지 않는다(바꾸면 인덱스를 다시 만들어야 한다).
검사 규칙은 hrsg-explorer-rag의 rag/corpus_all.py merge_sources와 같게 유지한다.
"""

import json
import logging
import os
import threading
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from app.domain.models.admin import RagSync, ReferenceDoc, ReferenceIssue, ReferencePatch

log = logging.getLogger(__name__)

DOC_FIELDS = ("doc_id", "title", "authors", "year", "venue", "doi", "url", "license", "source_type", "lang")
PARA_FIELDS = ("id", "doc_id", "section", "page_start", "page_end", "text", "terms", "content_type", "source_type")
CONTENT_TYPES = frozenset({"text", "table", "equation", "caption"})
SOURCE_TYPES = frozenset({"verbatim", "paraphrase"})
EDITABLE = ("title", "authors", "year", "venue", "doi", "url", "lang")
UNREADABLE_MARKERS = ("[판독 불가]", "[판독불가]", "[unreadable]", "[illegible]")


class ReferenceNotFound(Exception):
    pass


class ReferenceInvalid(Exception):
    def __init__(self, field: str):
        self.field = field


@dataclass
class _Loaded:
    docs: list[ReferenceDoc] = field(default_factory=list)
    issues: list[ReferenceIssue] = field(default_factory=list)
    files: dict[str, Path] = field(default_factory=dict)  # doc_id → R???.json
    mapping_path: Path | None = None


def _write_json(path: Path, data, indent: int) -> None:
    """임시 파일에 쓰고 바꿔치기 — 쓰는 도중 실패해도 원본이 깨지지 않는다"""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=indent) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def _page_range(paras: list[dict]) -> str | None:
    starts = [p["page_start"] for p in paras if isinstance(p.get("page_start"), int)]
    ends = [p["page_end"] for p in paras if isinstance(p.get("page_end"), int)] or starts
    if not starts:
        return None
    lo, hi = min(starts), max(ends)
    return str(lo) if lo == hi else f"{lo}–{hi}"


def _clean_doi(doi: str) -> str:
    doi = doi.strip()
    for prefix in ("https://doi.org/", "http://doi.org/", "doi:"):
        if doi.lower().startswith(prefix):
            return doi[len(prefix):].strip()
    return doi


class ReferenceStore:
    def __init__(self, corpus_dir: Path, corpus_all: Path | None = None, rag_api_url: str | None = None):
        self.corpus_dir = corpus_dir
        self.corpus_all = corpus_all
        self.rag_api_url = rag_api_url
        self._lock = threading.Lock()

    # ---- 읽기·검사 ----
    def _source_files(self) -> list[Path]:
        return sorted(
            p for p in self.corpus_dir.glob("*.json") if "mapping" not in p.name and p.name != "corpus_all.json"
        )

    def load(self) -> _Loaded:
        out = _Loaded()
        out.mapping_path = next(iter(sorted(self.corpus_dir.glob("*mapping*.json"))), None)
        mapping: dict[str, dict] = {}
        if out.mapping_path:
            try:
                mapping = {m["doc_id"]: m for m in json.loads(out.mapping_path.read_text(encoding="utf-8"))}
            except (OSError, ValueError, KeyError, TypeError) as e:
                out.issues.append(ReferenceIssue(level="error", code="invalid_file", detail=f"{out.mapping_path.name}: {e}"))

        add = out.issues.append
        seen_paras: set[str] = set()
        all_para_ids: list[str] = []
        source_docs: dict[str, dict] = {}
        for f in self._source_files():
            try:
                raw = json.loads(f.read_text(encoding="utf-8"))
                doc, paras = raw.get("document"), raw.get("paragraphs")
            except (OSError, ValueError, AttributeError) as e:
                add(ReferenceIssue(level="error", code="invalid_file", detail=f"{f.name}: {e}"))
                continue
            if not isinstance(doc, dict) or not isinstance(paras, list):
                add(ReferenceIssue(level="error", code="invalid_file", detail=f"{f.name}: document/paragraphs"))
                continue
            doc_id = str(doc.get("doc_id") or f.stem)
            if doc_id in out.files:
                add(ReferenceIssue(level="error", code="duplicate_doc_id", doc_id=doc_id, detail=f.name))
                continue
            out.files[doc_id] = f
            source_docs[doc_id] = doc
            for k in DOC_FIELDS:
                if k not in doc:
                    add(ReferenceIssue(level="error", code="missing_field", doc_id=doc_id, field=k))
            m = mapping.get(doc_id, {})
            if mapping and not m:
                add(ReferenceIssue(level="warning", code="mapping_missing", doc_id=doc_id))
            if m and m.get("paragraph_count") not in (None, len(paras)):
                add(ReferenceIssue(level="warning", code="paragraph_count_mismatch", doc_id=doc_id,
                                   detail=f"{len(paras)} ≠ {m['paragraph_count']}"))
            valid_paras = []
            for p in paras:
                pid = p.get("id") if isinstance(p, dict) else None
                missing = [k for k in PARA_FIELDS if not isinstance(p, dict) or k not in p]
                if missing:
                    add(ReferenceIssue(level="error", code="missing_field", doc_id=doc_id, paragraph_id=pid, field=missing[0]))
                    continue
                valid_paras.append(p)
                all_para_ids.append(pid)
                if pid in seen_paras:
                    add(ReferenceIssue(level="error", code="duplicate_paragraph_id", doc_id=doc_id, paragraph_id=pid))
                seen_paras.add(pid)
                if p["doc_id"] != doc_id:
                    add(ReferenceIssue(level="error", code="doc_id_mismatch", doc_id=doc_id, paragraph_id=pid))
                for k, allowed in (("content_type", CONTENT_TYPES), ("source_type", SOURCE_TYPES)):
                    if p[k] not in allowed:
                        add(ReferenceIssue(level="error", code="invalid_type", doc_id=doc_id, paragraph_id=pid, field=k))
                if not str(p["text"]).strip():
                    add(ReferenceIssue(level="warning", code="empty_text", doc_id=doc_id, paragraph_id=pid))

            ref = self._to_doc(doc_id, doc, valid_paras, m)
            out.docs.append(ref)
            out.issues += self._metadata_issues(ref)

        out.issues += self._corpus_all_issues(source_docs, all_para_ids)
        return out

    @staticmethod
    def _to_doc(doc_id: str, doc: dict, paras: list[dict], m: dict) -> ReferenceDoc:
        year = doc.get("year")
        return ReferenceDoc(
            doc_id=doc_id,
            title=str(doc.get("title") or ""),
            authors=[str(a) for a in doc.get("authors") or []],
            year=year if isinstance(year, int) else None,
            venue=str(doc.get("venue") or ""),
            doi=str(doc.get("doi") or ""),
            url=str(doc.get("url") or ""),
            lang=str(doc.get("lang") or ""),
            license=str(doc.get("license") or ""),
            source_type=str(doc.get("source_type") or ""),
            source_file=str(m.get("source_file") or ""),
            paragraph_count=len(paras),
            pages=_page_range(paras),
        )

    @staticmethod
    def _metadata_issues(d: ReferenceDoc) -> list[ReferenceIssue]:
        """출처 표시에 쓰이는 서지 정보 점검"""
        out = []
        w = lambda code, **kw: out.append(ReferenceIssue(level="warning", code=code, doc_id=d.doc_id, **kw))  # noqa: E731
        if not d.title.strip():
            w("empty_title", field="title")
        if not d.authors:
            w("no_authors", field="authors")
        if d.year is None:
            w("no_year", field="year")
        if not d.venue.strip():
            w("no_venue", field="venue")
        for k in ("title", "venue", "authors"):
            value = " ".join(d.authors) if k == "authors" else getattr(d, k)
            if any(marker in value for marker in UNREADABLE_MARKERS):
                w("unreadable_marker", field=k)
        return out

    def _corpus_all_issues(self, source_docs: dict[str, dict], para_ids: list[str]) -> list[ReferenceIssue]:
        """검색 API가 읽는 corpus_all.json이 문헌 JSON과 어긋났는지"""
        if not self.corpus_all:
            return []
        try:
            built = json.loads(self.corpus_all.read_text(encoding="utf-8"))
            built_docs = {d["doc_id"]: d for d in built["documents"]}
            built_paras = [p["id"] for p in built["paragraphs"]]
        except (OSError, ValueError, KeyError, TypeError) as e:
            return [ReferenceIssue(level="error", code="invalid_file", detail=f"{self.corpus_all.name}: {e}")]
        out = []
        for doc_id, doc in source_docs.items():
            b = built_docs.get(doc_id)
            if b is None:
                out.append(ReferenceIssue(level="warning", code="corpus_all_missing", doc_id=doc_id))
                continue
            for k in EDITABLE:
                if (b.get(k) or None) != (doc.get(k) or None):
                    out.append(ReferenceIssue(level="warning", code="corpus_all_stale", doc_id=doc_id, field=k))
        if Counter(built_paras) != Counter(para_ids):
            out.append(ReferenceIssue(level="warning", code="corpus_all_paragraphs_mismatch",
                                      detail=f"{len(built_paras)} / {len(para_ids)}"))
        return out

    # ---- 고치기 ----
    @staticmethod
    def _normalize(patch: ReferencePatch) -> dict:
        values = patch.model_dump(exclude_unset=True)
        out: dict = {}
        for k, v in values.items():
            if k == "authors":
                v = [a.strip() for a in (v or []) if a and a.strip()]
            elif k == "year":
                pass
            elif k == "lang":
                if v is None:
                    raise ReferenceInvalid("lang")
            else:
                v = " ".join((v or "").split()) if k in ("title", "venue") else (v or "").strip()
                if k == "doi":
                    v = _clean_doi(v)
                if k == "url" and v and not v.startswith(("http://", "https://")):
                    raise ReferenceInvalid("url")
            if k == "title" and not v:
                raise ReferenceInvalid("title")
            out[k] = v
        return out

    def update(self, doc_id: str, patch: ReferencePatch) -> tuple[ReferenceDoc, list[ReferenceIssue], RagSync]:
        changes = self._normalize(patch)
        with self._lock:
            loaded = self.load()
            path = loaded.files.get(doc_id)
            if path is None:
                raise ReferenceNotFound(doc_id)
            raw = json.loads(path.read_text(encoding="utf-8"))
            raw["document"].update(changes)
            _write_json(path, raw, indent=2)

            if loaded.mapping_path:
                mapping = json.loads(loaded.mapping_path.read_text(encoding="utf-8"))
                for m in mapping:
                    if m.get("doc_id") == doc_id:
                        m.update(changes)
                _write_json(loaded.mapping_path, mapping, indent=2)

            synced = False
            if self.corpus_all and self.corpus_all.is_file():
                built = json.loads(self.corpus_all.read_text(encoding="utf-8"))
                for d in built["documents"]:
                    if d.get("doc_id") == doc_id:
                        d.update(changes)
                        synced = True
                if synced:
                    _write_json(self.corpus_all, built, indent=1)

            after = self.load()
        doc = next(d for d in after.docs if d.doc_id == doc_id)
        issues = [i for i in after.issues if i.doc_id == doc_id]
        log.info("참고문헌 %s 서지 정보 수정: %s", doc_id, ", ".join(changes))
        return doc, issues, self._reload_rag() if synced else "not_configured"

    def _reload_rag(self) -> RagSync:
        """검색 API가 떠 있으면 문헌 정보를 다시 읽게 한다. 꺼져 있으면 다음 시작 때 corpus_all.json에서 읽는다"""
        if not self.rag_api_url:
            return "unavailable"
        req = urllib.request.Request(self.rag_api_url.rstrip("/") + "/documents/reload", data=b"", method="POST")
        try:
            with urllib.request.urlopen(req, timeout=5):
                return "reloaded"
        except urllib.error.HTTPError as e:
            log.warning("검색 API가 문헌 정보 다시 읽기를 거절했습니다: %s", e.code)
            return "rejected"
        except (urllib.error.URLError, TimeoutError, OSError):
            return "unavailable"
