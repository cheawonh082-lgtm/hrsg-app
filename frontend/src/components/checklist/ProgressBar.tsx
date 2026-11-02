import { useTranslation } from 'react-i18next'

import type { ChecklistProgress, ChecklistResponse } from '../../api/types'
import { cn } from '../../lib/cn'

/** 가로 막대 하나 (role=progressbar) */
export function Bar({ value, max, label, className, tone = 'accent' }: {
  value: number
  max: number
  label: string
  className?: string
  tone?: 'accent' | 'required'
}) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value}/${max} (${pct}%)`}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none', tone === 'required' ? 'bg-status-caution' : 'bg-status-normal')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/**
 * 진행률 (PRD §3.3): 전체 + 필수 분리, 카테고리별 미니 바.
 * 모바일은 상단 sticky — 전체 바와 "필수 n/m"만, 카테고리 바는 md 이상에서 표시(PRD §3.4.2).
 */
export function ProgressBar({ progress, categories }: { progress: ChecklistProgress; categories: ChecklistResponse['categories'] }) {
  const { t } = useTranslation()
  return (
    <section
      data-testid="checklist-progress"
      aria-label={t('checklist.progress.title')}
      className="card space-y-3 p-4 md:p-5"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="min-w-0 flex-1 font-semibold">
          {t('checklist.progress.overall')}{' '}
          <span data-testid="progress-percent" className="text-2xl text-status-normal tabular-nums">
            {progress.percent}%
          </span>
          <span className="ml-2 text-sm text-muted tabular-nums">
            ({progress.checked}/{progress.total})
          </span>
        </p>
        <p data-testid="progress-required" className="text-sm font-medium tabular-nums">
          {t('checklist.progress.required', { checked: progress.requiredChecked, total: progress.requiredTotal })}
        </p>
      </div>
      <Bar value={progress.checked} max={progress.total} label={t('checklist.progress.overall')} />
      <Bar
        value={progress.requiredChecked}
        max={progress.requiredTotal}
        label={t('checklist.progress.requiredLabel')}
        tone="required"
        className="h-1.5"
      />

      <ul className="hidden gap-x-6 gap-y-2 pt-1 md:grid md:grid-cols-2 xl:grid-cols-4">
        {categories.map((c) => {
          const p = progress.byCategory[c.id] ?? { total: 0, checked: 0 }
          return (
            <li key={c.id} className="min-w-0 space-y-1" data-testid={`progress-${c.id}`}>
              <div className="flex justify-between gap-2 text-xs">
                <span className="truncate text-muted" title={c.label}>
                  {c.label}
                </span>
                <span className="shrink-0 tabular-nums">
                  {p.checked}/{p.total}
                </span>
              </div>
              <Bar value={p.checked} max={p.total} label={c.label} className="h-1.5" />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
