import { ChevronDown, FileText } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Citation } from '../../api/types'

type Style = 'excerpts' | 'titles'

/** 같은 문서(별칭·논문명)는 한 번만 — 답변의 [n]은 items의 1부터 센 번호다 */
function distinct(items: Citation[], nums?: number[]): { n: number; c: Citation }[] {
  const seen = new Set<string>()
  const picked = (nums ?? items.map((_, i) => i + 1)).filter((n) => items[n - 1])
  return picked.flatMap((n) => {
    const c = items[n - 1]
    if (seen.has(c.docAlias)) return []
    seen.add(c.docAlias)
    return [{ n, c }]
  })
}

/** 칩 팝오버는 답변 문단(<p>) 안에 들어가므로 블록 요소 대신 span만 쓴다 */
function SourceDetail({ c, style }: { c: Citation; style: Style }) {
  return (
    <>
      <span className="block font-medium text-text">{c.docAlias}</span>
      {c.sectionTitle && <span className="block text-xs text-muted">{c.sectionTitle}</span>}
      {/* 논문 RAG(titles)는 논문명만, 내장 문서는 마스킹된 발췌까지 */}
      {style === 'excerpts' && <span className="mt-1 line-clamp-3 block text-xs text-muted">{c.snippet}</span>}
    </>
  )
}

/**
 * 문단 끝 출처 칩 (ChatGPT 형식) — 첫 출처 이름 + 나머지 개수(+N). 누르면 출처 목록이 뜬다.
 * 원문 열기·다운로드는 두지 않는다(PRD §5).
 */
export function CitationChip({ items, nums, style }: { items: Citation[]; nums: number[]; style: Style }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const popId = useId()
  const sources = distinct(items, nums)

  const toggle = () => {
    // 줄 끝의 칩이면 팝오버(18rem)를 왼쪽으로 펼쳐 화면 밖으로 나가지 않게 한다
    const left = ref.current?.getBoundingClientRect().left ?? 0
    setAlignRight(left + 18 * 16 > window.innerWidth - 16)
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  if (!sources.length) return null
  const [first, ...rest] = sources
  return (
    <span ref={ref} className="relative ml-1 inline-block align-baseline">
      <button
        type="button"
        data-testid="citation-chip"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={t('chat.citations.chipLabel', { names: sources.map((s) => s.c.docAlias).join(', ') })}
        onClick={toggle}
        className="inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 align-middle text-xs font-medium text-muted transition-colors hover:bg-tone-blue-bg hover:text-tone-blue focus-visible:outline-2 focus-visible:outline-accent aria-expanded:bg-tone-blue-bg aria-expanded:text-tone-blue"
      >
        <span className="truncate">{first.c.docAlias}</span>
        {rest.length > 0 && <span className="shrink-0">+{rest.length}</span>}
      </button>
      {open && (
        <span
          id={popId}
          role="dialog"
          aria-label={t('chat.citations.sources')}
          className={`absolute top-full ${alignRight ? 'right-0' : 'left-0'} z-20 mt-1 block w-72 max-w-[calc(100vw-3rem)] space-y-2 rounded-xl border border-border bg-surface p-3 text-left text-sm shadow-lg`}
        >
          {sources.map(({ n, c }) => (
            <span key={n} className="flex gap-2">
              <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span className="block min-w-0">
                <SourceDetail c={c} style={style} />
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

/** 답변 아래 "출처" 버튼 — 누르면 이 답변이 쓴 출처 전체 목록을 펼친다 */
export function CitationList({ items, mockDocs, style = 'excerpts' }: { items: Citation[]; mockDocs?: boolean; style?: Style }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const listId = useId()
  const sources = distinct(items)

  return (
    <section data-testid="citations" aria-label={t('chat.citations.sources')} className="text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 font-medium text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
        >
          <FileText aria-hidden className="size-4" />
          {t('chat.citations.sources')}
          <span className="text-xs">{sources.length}</span>
          <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {mockDocs && style === 'excerpts' && (
          <span className="rounded-md bg-mock-bg px-1.5 py-0.5 text-xs font-bold text-mock-fg">{t('chat.citations.mock')}</span>
        )}
      </div>
      {open && (
        <ol id={listId} className="mt-2 space-y-2">
          {sources.map(({ n, c }) => (
            <li key={n} className="flex gap-2 rounded-lg border border-border bg-surface p-3">
              <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <SourceDetail c={c} style={style} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
