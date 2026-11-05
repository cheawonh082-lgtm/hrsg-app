import { FolderX, Pencil, RefreshCw, Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useReferences } from '../../api/hooks/useAdmin'
import type { ReferenceDoc, ReferenceIssue } from '../../api/types'
import { cn } from '../../lib/cn'
import { Panel, Skeleton } from '../common/Panel'
import { type ResponsiveColumn, ResponsiveTable } from '../layout/ResponsiveTable'
import { IssueBadges, IssueList } from './IssueList'
import { ReferenceEditDialog } from './ReferenceEditDialog'
import { btnSecondary, inputClass } from './ui'

type Filter = 'all' | 'issues'

export function ReferencesPanel() {
  const { t } = useTranslation()
  const query = useReferences(true)
  const data = query.data
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const searchId = useId()

  const byDoc = useMemo(() => {
    const m = new Map<string, ReferenceIssue[]>()
    for (const i of data?.issues ?? []) if (i.docId) m.set(i.docId, [...(m.get(i.docId) ?? []), i])
    return m
  }, [data?.issues])
  const globalIssues = (data?.issues ?? []).filter((i) => !i.docId)
  const errors = (data?.issues ?? []).filter((i) => i.level === 'error').length
  const warnings = (data?.issues.length ?? 0) - errors

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.documents ?? []).filter(
      (d) =>
        (filter === 'all' || byDoc.has(d.docId)) &&
        (!q || [d.docId, d.title, d.venue, ...d.authors].some((v) => v.toLowerCase().includes(q))),
    )
  }, [data?.documents, filter, search, byDoc])

  const columns: ResponsiveColumn<ReferenceDoc>[] = [
    {
      key: 'docId',
      header: t('admin.fields.docId'),
      render: (d) => <span className="font-mono text-xs">{d.docId}</span>,
      sortValue: (d) => d.docId,
      mobile: 'field',
    },
    {
      key: 'title',
      header: t('admin.fields.title'),
      render: (d) =>
        d.title ? (
          <span className="line-clamp-2 block max-w-[28rem] min-w-0" title={d.title}>
            {d.title}
          </span>
        ) : (
          <span className="font-semibold text-status-danger">{t('admin.refs.noTitle')}</span>
        ),
      sortValue: (d) => d.title || null,
      mobile: 'title',
    },
    {
      key: 'authors',
      header: t('admin.fields.authors'),
      render: (d) =>
        d.authors.length ? (
          <span className="block max-w-[10rem] truncate" title={d.authors.join('; ')}>
            {d.authors[0]}
            {d.authors.length > 1 && ` ${t('chat.citations.etAl')}`}
          </span>
        ) : (
          '—'
        ),
      mobile: 'field',
    },
    { key: 'year', header: t('admin.fields.year'), render: (d) => d.year ?? '—', sortValue: (d) => d.year, mobile: 'field', align: 'right' },
    {
      key: 'paragraphs',
      header: t('admin.fields.paragraphs'),
      render: (d) => d.paragraphCount,
      sortValue: (d) => d.paragraphCount,
      mobile: 'field',
      align: 'right',
    },
    {
      key: 'issues',
      header: t('admin.refs.check'),
      render: (d) => <IssueBadges issues={byDoc.get(d.docId) ?? []} />,
      sortValue: (d) => (byDoc.get(d.docId) ?? []).reduce((n, i) => n + (i.level === 'error' ? 100 : 1), 0),
      mobile: 'field',
    },
    {
      key: 'edit',
      header: t('admin.refs.edit'),
      render: (d) => (
        <button
          type="button"
          onClick={() => setEditing(d.docId)}
          aria-label={t('admin.refs.editLabel', { id: d.docId })}
          className={cn(btnSecondary, 'min-h-9 px-2.5 text-sm whitespace-nowrap')}
        >
          <Pencil aria-hidden className="size-4" />
          {t('admin.refs.edit')}
        </button>
      ),
      mobile: 'field',
    },
  ]

  if (query.isPending) return <Skeleton className="h-96" />
  if (query.isError || !data) {
    return (
      <Panel title={t('admin.refs.title')}>
        <p role="alert" className="text-status-danger">
          {t('admin.errors.loadFailed')}
        </p>
      </Panel>
    )
  }

  if (!data.configured) {
    return (
      <Panel title={t('admin.refs.title')}>
        <div className="flex items-start gap-3 text-sm">
          <FolderX aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
          <div className="space-y-2">
            <p className="font-medium">{t('admin.refs.notConfigured')}</p>
            <p className="text-muted">{t('admin.refs.notConfiguredHint')}</p>
            <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">
              RAG_CORPUS_DIR=../../hrsg-explorer-rag/rag_corpus{'\n'}RAG_CORPUS_ALL_PATH=../../hrsg-explorer-rag/data/rag/corpus_all.json
            </pre>
          </div>
        </div>
      </Panel>
    )
  }

  const editingDoc = data.documents.find((d) => d.docId === editing) ?? null

  return (
    <div className="space-y-4">
      <Panel title={t('admin.refs.title')}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 basis-48">
            <p data-testid="refs-summary" className="text-sm">
              {t('admin.refs.summary', { docs: data.documents.length, errors, warnings })}
            </p>
            <p className="mt-0.5 text-xs break-all text-muted" title={data.corpusAllPath ?? undefined}>
              {data.corpusDir}
            </p>
          </div>
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className={btnSecondary}>
            <RefreshCw aria-hidden className={cn('size-4', query.isFetching && 'animate-spin')} />
            {t('admin.refs.recheck')}
          </button>
        </div>

        {globalIssues.length > 0 && (
          <div className="mb-4 rounded-lg border border-border p-3">
            <IssueList issues={globalIssues} />
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-3">
          <div className="relative min-w-0 flex-1 basis-56">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <label htmlFor={searchId} className="sr-only">
              {t('admin.refs.search')}
            </label>
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.refs.search')}
              className={cn(inputClass, 'pl-9')}
            />
          </div>
          <div role="group" aria-label={t('admin.refs.filter')} className="flex gap-2">
            {(['all', 'issues'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm font-medium',
                  filter === f ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-muted hover:text-text',
                )}
              >
                {t(`admin.refs.filters.${f}`)}
              </button>
            ))}
          </div>
        </div>

        {rows.length ? (
          <ResponsiveTable
            rows={rows}
            columns={columns}
            rowKey={(d) => d.docId}
            caption={t('admin.refs.title')}
            defaultSort={{ key: 'docId', dir: 'asc' }}
          />
        ) : (
          <p className="py-6 text-center text-sm text-muted">{t('admin.refs.empty')}</p>
        )}
      </Panel>

      <ReferenceEditDialog doc={editingDoc} issues={editing ? byDoc.get(editing) ?? [] : []} onClose={() => setEditing(null)} />
    </div>
  )
}
