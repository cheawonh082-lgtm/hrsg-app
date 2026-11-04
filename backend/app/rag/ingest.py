"""원문 → 마스킹 → 섹션 정리 → data/docs_masked/ (PRD §5: 원문은 인덱싱·서빙 금지, 마스킹본만 사용).

사용법 (backend 폴더에서):
    python -m app.rag.ingest            # .env의 DOCS_RAW_DIR → DOCS_MASKED_DIR
    python -m app.rag.ingest --dry-run  # 쓰지 않고 결과만 출력

지원 형식: .md, .txt (UTF-8). PDF·DOCX는 텍스트로 변환해 넣는다(변환기 추가 지점: _read_text).
원문 파일명 → 별칭(TECH-DOC-###) 대응표는 원문 폴더의 `.aliases.json`에만 저장한다(마스킹본에 파일명 비노출).
"""

import argparse
import json
from pathlib import Path

from app.config import get_settings
from app.guardrails.redactor import Redactor
from app.rag.store import parse_document, split_sections

SUPPORTED = {".md", ".txt"}
ALIAS_FILE = ".aliases.json"


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _assign_aliases(raw_dir: Path, files: list[Path]) -> dict[str, str]:
    alias_path = raw_dir / ALIAS_FILE
    aliases: dict[str, str] = json.loads(alias_path.read_text(encoding="utf-8")) if alias_path.is_file() else {}
    next_no = max((int(a.rsplit("-", 1)[-1]) for a in aliases.values()), default=0) + 1
    for f in files:
        if f.name not in aliases:
            aliases[f.name] = f"TECH-DOC-{next_no:03d}"
            next_no += 1
    return aliases


def ingest(raw_dir: Path, masked_dir: Path, redactor: Redactor, dry_run: bool = False) -> list[str]:
    files = sorted(p for p in raw_dir.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED)
    aliases = _assign_aliases(raw_dir, files)
    report = []
    for f in files:
        meta, body = parse_document(_read_text(f))
        alias = aliases[f.name]
        title = redactor.redact(meta.get("title") or alias).text
        lang = meta.get("lang") or ("ko" if any("가" <= ch <= "힣" for ch in body) else "en")
        redactions = 0
        lines = ["---", f"alias: {alias}", f"title: {title}", f"lang: {lang}"]
        # 출처 표기용 서지 정보는 그대로 옮긴다(저자·발행처는 마스킹). 절별 쪽수는 "## 절 제목 (p. 12)"로 남긴다
        for key in ("authors", "year", "publisher", "venue", "pages", "url"):
            if meta.get(key):
                value = meta[key] if key in ("year", "pages", "url") else redactor.redact(meta[key]).text
                lines.append(f"{key}: {value}")
        lines.append("---")
        sections = split_sections(body)
        for section_title, text in sections:
            r = redactor.redact(text)
            redactions += r.count
            if section_title:
                lines.append(f"## {redactor.redact(section_title).text}")
            lines += [r.text, ""]
        report.append(f"{alias}: {len(sections)} sections, {redactions} redactions")
        if not dry_run:
            masked_dir.mkdir(parents=True, exist_ok=True)
            (masked_dir / f"{alias}.md").write_text("\n".join(lines), encoding="utf-8")
    if not dry_run and files:
        (raw_dir / ALIAS_FILE).write_text(json.dumps(aliases, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> None:
    settings = get_settings()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw", type=Path, default=settings.docs_raw_dir)
    parser.add_argument("--out", type=Path, default=settings.docs_masked_dir)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.raw.is_dir():
        raise SystemExit(f"원문 폴더가 없습니다: {args.raw}")
    report = ingest(args.raw, args.out, Redactor.load(settings.secrets_dir), args.dry_run)
    print("\n".join(report) if report else "(문서 없음)")


if __name__ == "__main__":
    main()
