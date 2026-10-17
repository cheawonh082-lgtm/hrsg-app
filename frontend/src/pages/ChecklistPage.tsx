import { CloudOff, Mail, RotateCcw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { useChecklist, useChecklistMutations, usePendingStore, useRestorePending } from '../api/hooks/useChecklist'
import type { ChecklistCategory, ChecklistItemPatch, ChecklistItemState } from '../api/types'
import { ChecklistSection } from '../components/checklist/ChecklistSection'
import { EmailExportDialog } from '../components/checklist/EmailExportDialog'
import { ProgressBar } from '../components/checklist/ProgressBar'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { applyCheck, type ChecklistFilter, filterItems } from '../lib/checklist'
import { cn } from '../lib/cn'
import { useToastStore } from '../store/toast'
import { useUiStore } from '../store/ui'

const FILTERS: ChecklistFilter[] = ['all', 'required', 'unchecked']
const HIGHLIGHT_MS = 4000

export function ChecklistPage() {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const { isMobile } = useBreakpoint()
  const query = useChecklist(locale)
  const data = query.data
  const { update, retryPending, reset } = useChecklistMutations()
  const pendingCount = usePendingStore((s) => s.count)
  const showToast = useToastStore((s) => s.show)
  useRestorePending(!!data)

  const [filter, setFilter] = useState<ChecklistFilter>('all')
  const [search, setSearch] = useState('')
  const [closed, setClosed] = useState<Set<ChecklistCategory>>(new Set())
  const [emailOpen, setEmailOpen] = useState(false)
  const [highlight, setHighlight] = useState<{ category: ChecklistCategory; items: Set<string> } | null>(null)

  // 계산기 핀치 "데이터 필요" → /checklist?focus=<category>&fields=<calc fields>: 섹션 펼침·스크롤·강조
  const [searchParams, setSearchParams] = useSearchParams()
  const focus = searchParams.get('focus') as ChecklistCategory | null
  useEffect(() => {
    if (!focus || !data) return
    const fields = new Set((searchParams.get('fields') ?? '').split(',').filter(Boolean))
    const items = new Set(
      data.items.filter((i) => i.category === focus && i.linkedCalcField && fields.has(i.linkedCalcField)).map((i) => i.id),
    )
    setFilter('all')
    setSearch('')
    setClosed((prev) => new Set([...prev].filter((c) => c !== focus)))
    setHighlight({ category: focus, items })
    setSearchParams({}, { replace: true })
    requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document.getElementById(`cat-${focus}`)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
    })
  }, [focus, data, searchParams, setSearchParams])

  useEffect(() => {
    if (!highlight) return
    const timer = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [highlight])

  const states = useMemo(() => new Map((data?.states ?? []).map((s) => [s.itemId, s])), [data?.states])
  const visible = useMemo(
    () => (data ? filterItems(data.items, data.states, filter, search) : []),
    [data, filter, search],
  )
  const statesVersion = useMemo(
    () => (data?.states ?? []).map((s) => `${s.itemId}:${s.checked ? 1 : 0}:${s.status}:${s.memo ?? ''}`).join('|'),
    [data?.states],
  )

  const onChange = useCallback(
    async (itemId: string, patch: ChecklistItemPatch) => {
      const ok = await update(itemId, patch)
      if (!ok) showToast(t('checklist.sync.failed'), 'error')
    },
    [update, showToast, t],
  )

  const onCheckAll = (category: ChecklistCategory, checked: boolean) => {
    for (const item of data?.items.filter((i) => i.category === category) ?? []) {
      const state = states.get(item.id) as ChecklistItemState
      if (state.status === 'na' || state.checked === checked) continue
      void onChange(item.id, applyCheck(state, checked))
    }
  }

  const onReset = async () => {
    if (!window.confirm(t('checklist.reset.confirm'))) return
    await reset()
    showToast(t('checklist.reset.done'), 'info')
  }

  const toggle = (c: ChecklistCategory) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 pb-20 md:pb-0">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-bold">{t('pages.checklistTitle')}</h1>
          <p className="text-muted">{t('checklist.subtitle')}</p>
        </div>
        {!isMobile && (
          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            disabled={!data}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <Mail aria-hidden className="size-4" />
            {t('checklist.email.open')}
          </button>
        )}
      </header>

      {pendingCount > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-status-caution/40 bg-status-caution/10 p-3 text-sm">
          <CloudOff aria-hidden className="size-4 shrink-0 text-status-caution" />
          <span className="min-w-0 flex-1">{t('checklist.sync.pending', { count: pendingCount })}</span>
          <button
            type="button"
            onClick={() => void retryPending()}
            className="min-h-11 rounded-lg border border-border bg-surface px-3 font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {t('checklist.sync.retry')}
          </button>
        </div>
      )}

      {query.isError && (
        <p role="alert" className="rounded-lg border border-status-danger/40 bg-status-danger/10 p-3 text-status-danger">
          {t('checklist.loadError')}
        </p>
      )}

      {data && (
        <>
          {/* 모바일: 진행률을 헤더 아래 고정 (PRD §3.4.2) */}
          <div className="sticky top-[var(--app-header-h,3.5rem)] z-10 -mx-4 bg-bg/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <ProgressBar progress={data.progress} categories={data.categories} />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-0 md:max-w-sm md:flex-1">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('checklist.search')}
                aria-label={t('checklist.search')}
                className="h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-base"
              />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div role="group" aria-label={t('checklist.filter.label')} className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none]">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'min-h-11 shrink-0 rounded-lg border px-3 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent',
                      filter === f ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface hover:bg-surface-2',
                    )}
                  >
                    {t(`checklist.filter.${f}`)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void onReset()}
                className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <RotateCcw aria-hidden className="size-4" />
                {t('checklist.reset.button')}
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">{t('checklist.empty')}</p>
          ) : (
            <div className="space-y-3">
              {data.categories.map((c) => {
                const items = visible.filter((i) => i.category === c.id)
                if (!items.length) return null
                return (
                  <ChecklistSection
                    key={c.id}
                    id={c.id}
                    label={c.label}
                    items={items}
                    states={states}
                    progress={data.progress.byCategory[c.id] ?? { total: 0, checked: 0 }}
                    open={!closed.has(c.id)}
                    onToggle={() => toggle(c.id)}
                    highlighted={highlight?.category === c.id}
                    highlightedItems={highlight?.category === c.id ? highlight.items : undefined}
                    onChange={(id, patch) => void onChange(id, patch)}
                    onCheckAll={(checked) => onCheckAll(c.id, checked)}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {/* 모바일: 하단 고정 FAB → 전체 화면 다이얼로그 (PRD §3.4.2) */}
      {isMobile && data && (
        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-accent-fg shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Mail aria-hidden className="size-5" />
          {t('checklist.email.fab')}
        </button>
      )}

      <EmailExportDialog open={emailOpen} onClose={() => setEmailOpen(false)} statesVersion={statesVersion} />
    </section>
  )
}
