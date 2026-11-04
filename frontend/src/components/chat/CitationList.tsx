import { ChevronDown, ExternalLink, FileText, Sparkles } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Citation } from '../../api/types'
import { fullCite, groupSources, shortCite, type Source } from '../../lib/citation'

type Style = 'excerpts' | 'titles'

/** 칩 팝오버는 답변 문단(<p>) 안에 들어가므로 블록 요소 대신 span만 쓴다 */
function SourceDetail({ s, style }: { s: Source; style: Style }) {
  const { t } = useTranslation()
  const { c } = s
  return (
    <>
      <span className="block text-text">{fullCite(s, t('chat.citations.etAl'))}</span>
      {c.sectionTitle && <span className="block text-xs text-muted">§ {c.sectionTitle}</span>}
      {c.url && (
        <a href={c.url} target="_blank" rel="noreferrer noopener" className="mt-0.5 inline-flex items-center gap-1 text-xs text-tone-blue hover:underline">
          <ExternalLink aria-hidden className="size-3" />
          {t('chat.citations.link')}
        </a>
      )}
      {/* 내장 문서(excerpts)는 마스킹된 발췌까지 — 논문 RAG(titles)는 서지 정보만 */}
      {style === 'excerpts' && <span className="mt-1 line-clamp-3 block text-xs text-muted">{c.snippet}</span>}
    </>
  )
}

/** 자료에 근거가 없어 AI가 일반 지식으로 보충한 부분의 출처 */
function AiDetail({ model }: { model: string }) {
  const { t } = useTranslation()
  return (
    <>
      <span className="block font-medium text-text">{t('chat.citations.aiSource', { model })}</span>
      <span className="block text-xs text-muted">{t('chat.citations.aiDetail')}</span>
    </>
  )
}

/** 문단 끝 칩 + 누르면 뜨는 팝오버. 줄 끝의 칩이면 팝오버를 왼쪽으로 펼친다 */
function Chip({ label, name, testId, children }: { label: ReactNode; name: string; testId: string; children: ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const popId = useId()

  const toggle = () => {
    const left = ref.current?.getBoundingClientRect().left ?? 0
    setAlignRight(left + 18 * 16 > window.innerWidth - 16) // 팝오버 너비 18rem
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

  return (
    <span ref={ref} className="relative ml-1 inline-block align-baseline">
      <button
        type="button"
        data-testid={testId}
        aria-expanded={open}
        aria-controls={popId}
        aria-label={t('chat.citations.chipLabel', { names: name })}
        onClick={toggle}
        className="inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 align-middle text-xs font-medium text-muted transition-colors hover:bg-tone-blue-bg hover:text-tone-blue focus-visible:outline-2 focus-visible:outline-accent aria-expanded:bg-tone-blue-bg aria-expanded:text-tone-blue"
      >
        {label}
      </button>
      {open && (
        <span
          id={popId}
          role="dialog"
          aria-label={t('chat.citations.sources')}
          className={`absolute top-full ${alignRight ? 'right-0' : 'left-0'} z-20 mt-1 block w-72 max-w-[calc(100vw-3rem)] space-y-2 rounded-xl border border-border bg-surface p-3 text-left text-sm shadow-lg`}
        >
          {children}
        </span>
      )}
    </span>
  )
}

/**
 * 문단 끝 출처 칩 (ChatGPT 형식) — 첫 출처 "저자 외 (연도)" + 나머지 개수(+N). 누르면 서지 정보가 뜬다.
 * 원문 열기·다운로드는 두지 않는다(PRD §5). 공개 논문의 DOI·URL 링크만 표시한다.
 */
export function CitationChip({ items, nums, style }: { items: Citation[]; nums: number[]; style: Style }) {
  const { t } = useTranslation()
  const sources = groupSources(items, nums)
  if (!sources.length) return null
  const etAl = t('chat.citations.etAl')
  const [first, ...rest] = sources
  return (
    <Chip
      testId="citation-chip"
      name={sources.map((s) => shortCite(s.c, etAl)).join(', ')}
      label={
        <>
          <span className="truncate">{shortCite(first.c, etAl)}</span>
          {rest.length > 0 && <span className="shrink-0">+{rest.length}</span>}
        </>
      }
    >
      {sources.map((s) => (
        <span key={s.n} className="flex gap-2">
          <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <span className="block min-w-0">
            <SourceDetail s={s} style={style} />
          </span>
        </span>
      ))}
    </Chip>
  )
}

/** [AI] 칩 — 자료 근거 없이 일반 지식으로 보충한 부분 */
export function AiChip({ model }: { model: string }) {
  const { t } = useTranslation()
  return (
    <Chip
      testId="ai-chip"
      name={t('chat.citations.ai')}
      label={
        <>
          <Sparkles aria-hidden className="size-3 shrink-0" />
          <span>{t('chat.citations.ai')}</span>
        </>
      }
    >
      <span className="flex gap-2">
        <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
        <span className="block min-w-0">
          <AiDetail model={model} />
        </span>
      </span>
    </Chip>
  )
}

/** 답변 아래 "출처" 버튼 — 누르면 이 답변이 쓴 출처 전체 목록(일반 지식 보충 포함)을 펼친다 */
export function CitationList({
  items,
  nums,
  mockDocs,
  style = 'excerpts',
  aiModel,
}: {
  items: Citation[]
  nums?: number[] // 본문에서 인용한 번호만 (없으면 전체)
  mockDocs?: boolean
  style?: Style
  aiModel?: string | null
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const listId = useId()
  const sources = groupSources(items, nums)
  if (!sources.length && !aiModel) return null

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
          <span className="text-xs">{sources.length + (aiModel ? 1 : 0)}</span>
          <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {mockDocs && style === 'excerpts' && sources.length > 0 && (
          <span className="rounded-md bg-mock-bg px-1.5 py-0.5 text-xs font-bold text-mock-fg">{t('chat.citations.mock')}</span>
        )}
      </div>
      {open && (
        <ol id={listId} className="mt-2 space-y-2">
          {sources.map((s) => (
            <li key={s.n} className="flex gap-2 rounded-lg border border-border bg-surface p-3">
              <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <SourceDetail s={s} style={style} />
              </div>
            </li>
          ))}
          {aiModel && (
            <li className="flex gap-2 rounded-lg border border-dashed border-border bg-surface p-3">
              <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <AiDetail model={aiModel} />
              </div>
            </li>
          )}
        </ol>
      )}
    </section>
  )
}
