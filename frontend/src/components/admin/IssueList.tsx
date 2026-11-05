import { OctagonAlert, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ReferenceIssue } from '../../api/types'
import { cn } from '../../lib/cn'

/** 검사 결과 한 줄 — 코드별 문구에 필드·문단·상세를 채운다 */
export function useIssueText() {
  const { t } = useTranslation()
  return (i: ReferenceIssue) =>
    t(`admin.issues.${i.code}`, {
      field: i.field ? t(`admin.fields.${i.field}`, { defaultValue: i.field }) : '',
      paragraph: i.paragraphId ?? '',
      detail: i.detail ?? '',
    })
}

export function IssueList({ issues, showDoc = false }: { issues: ReferenceIssue[]; showDoc?: boolean }) {
  const text = useIssueText()
  if (!issues.length) return null
  return (
    <ul className="space-y-1.5 text-sm">
      {issues.map((i, n) => {
        const Icon = i.level === 'error' ? OctagonAlert : TriangleAlert
        return (
          <li key={n} data-level={i.level} className="flex items-start gap-2">
            <Icon
              aria-hidden
              className={cn('mt-0.5 size-4 shrink-0', i.level === 'error' ? 'text-status-danger' : 'text-status-caution')}
            />
            <span className="min-w-0">
              {showDoc && i.docId && <span className="mr-1.5 font-mono text-xs text-muted">{i.docId}</span>}
              {text(i)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** 표 안의 개수 배지 */
export function IssueBadges({ issues }: { issues: ReferenceIssue[] }) {
  const { t } = useTranslation()
  const errors = issues.filter((i) => i.level === 'error').length
  const warnings = issues.length - errors
  if (!issues.length) return <span className="text-xs text-status-normal">{t('admin.refs.ok')}</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {errors > 0 && (
        <span className="rounded-full border border-status-danger/40 bg-status-danger/10 px-2 py-0.5 text-xs font-semibold text-status-danger">
          {t('admin.refs.errorCount', { count: errors })}
        </span>
      )}
      {warnings > 0 && (
        <span className="rounded-full border border-status-caution/40 bg-status-caution/10 px-2 py-0.5 text-xs font-semibold text-status-caution">
          {t('admin.refs.warningCount', { count: warnings })}
        </span>
      )}
    </span>
  )
}
