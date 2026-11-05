import { CircleCheck, CircleX, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useAdminStatus } from '../../api/hooks/useAdmin'
import { cn } from '../../lib/cn'
import { Panel, Skeleton } from '../common/Panel'
import { btnSecondary } from './ui'

function Ok({ ok, children }: { ok: boolean; children: ReactNode }) {
  const Icon = ok ? CircleCheck : CircleX
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', ok ? 'text-status-normal' : 'text-status-danger')}>
      <Icon aria-hidden className="size-4" />
      {children}
    </span>
  )
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 text-right font-medium break-all">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function SystemStatusPanel() {
  const { t, i18n } = useTranslation()
  const query = useAdminStatus(true)
  const s = query.data
  const fmt = (iso: string) => new Date(iso).toLocaleString(i18n.language)

  if (query.isPending) return <Skeleton className="h-96" />
  if (query.isError || !s) {
    return (
      <Panel title={t('admin.status.title')}>
        <p role="alert" className="text-status-danger">
          {t('admin.errors.loadFailed')}
        </p>
      </Panel>
    )
  }

  const api = s.rag.api
  const methods = Object.entries(api.methods ?? {})

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted">
          {t('admin.status.started', { time: fmt(s.startedAt), version: s.version })}
        </p>
        <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className={btnSecondary}>
          <RefreshCw aria-hidden className={cn('size-4', query.isFetching && 'animate-spin')} />
          {t('admin.status.refresh')}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t('admin.status.llm')}>
          <Rows
            rows={[
              [t('admin.status.provider'), s.llm.provider],
              [t('admin.status.model'), s.llm.model ?? '—'],
              [
                t('admin.status.apiKey'),
                s.llm.provider === 'fake' ? '—' : <Ok ok={s.llm.keySet}>{t(s.llm.keySet ? 'admin.status.set' : 'admin.status.unset')}</Ok>,
              ],
              ...(s.llm.fallbackModels.length ? [[t('admin.status.fallback'), s.llm.fallbackModels.join(', ')] as [string, ReactNode]] : []),
              [t('admin.status.logPrompts'), t(s.llm.logPrompts ? 'admin.status.on' : 'admin.status.off')],
            ]}
          />
        </Panel>

        <Panel title={t('admin.status.search')}>
          <Rows
            rows={[
              [t('admin.status.retriever'), t(`admin.status.retrievers.${s.rag.retriever}`)],
              [
                t('admin.status.keywordDocs'),
                t(s.rag.docs === 'mock' ? 'admin.status.mockDocs' : 'admin.status.realDocs', { count: s.rag.keywordDocs }),
              ],
              [
                t('admin.status.ragApi'),
                <Ok key="api" ok={api.reachable}>
                  {api.reachable ? t('admin.status.connected') : t('admin.status.disconnected')}
                </Ok>,
              ],
              [t('admin.status.ragUrl'), api.url],
              ...(api.reachable
                ? ([
                    [t('admin.status.corpus'), t('admin.status.corpusCount', { docs: api.documents ?? 0, paras: api.paragraphs ?? 0 })],
                    [
                      t('admin.status.methods'),
                      methods.map(([m, ok]) => (
                        <span key={m} className={cn('ml-2 inline-block', ok ? 'text-status-normal' : 'text-status-danger')}>
                          {m}
                          {ok ? '✓' : '✕'}
                        </span>
                      )),
                    ],
                  ] as [string, ReactNode][])
                : api.error
                  ? ([[t('admin.status.error'), <span key="e" className="text-muted">{api.error}</span>]] as [string, ReactNode][])
                  : []),
            ]}
          />
          {Object.entries(api.missing ?? {}).map(([name, why]) => (
            <p key={name} className="mt-2 text-xs text-status-caution">
              {name}: {why}
            </p>
          ))}
        </Panel>

        <Panel title={t('admin.status.app')}>
          <Rows
            rows={[
              [t('admin.status.calcEngine'), s.calcEngine],
              [t('admin.status.dataSource'), s.dataSource],
              [t('admin.status.sessionExpires'), fmt(s.sessionExpiresAt)],
            ]}
          />
        </Panel>

        <Panel title={t('admin.status.references')}>
          <Rows
            rows={[
              [
                t('admin.status.refsConfigured'),
                <Ok key="r" ok={s.references.configured}>
                  {t(s.references.configured ? 'admin.status.set' : 'admin.status.unset')}
                </Ok>,
              ],
              [t('admin.status.corpusDir'), s.references.corpusDir ?? '—'],
              [t('admin.status.corpusAll'), s.references.corpusAllPath ?? '—'],
            ]}
          />
        </Panel>
      </div>

      <Panel title={t('admin.status.logs')} aside={t('admin.status.logsHint')}>
        {s.recentLogs.length ? (
          <ol data-testid="admin-logs" className="divide-y divide-border text-sm">
            {s.recentLogs.map((l, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 py-2">
                <span className={cn('font-semibold', l.level === 'WARNING' ? 'text-status-caution' : 'text-status-danger')}>{l.level}</span>
                <time className="text-muted tabular-nums">{fmt(l.time)}</time>
                <span className="font-mono text-xs text-muted">{l.logger}</span>
                <span className="w-full min-w-0 break-words">{l.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">{t('admin.status.noLogs')}</p>
        )}
      </Panel>
    </div>
  )
}
