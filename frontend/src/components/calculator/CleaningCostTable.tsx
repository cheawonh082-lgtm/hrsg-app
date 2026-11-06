import { Award } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { CleaningMethodComparison } from '../../api/types'
import { cn } from '../../lib/cn'
import { formatKrwCompact, formatKrwFull, formatNumber } from '../../lib/format'
import { useUiStore } from '../../store/ui'
import { type ResponsiveColumn, ResponsiveTable } from '../layout/ResponsiveTable'

/**
 * 세정 공법별 비교 (키트 compareMethods().rows). md 이상 정렬 표 / 모바일 카드 리스트 (ResponsiveTable).
 * 비용 = 총투자(세정 비용 + 간접 비용 + 정지 손실), 순편익 = 연간 순편익. 가장 좋은 공법은 「순편익 최대」로 표시한다.
 */
export function CleaningCostTable({ rows }: { rows: CleaningMethodComparison[] }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const maxAbsBenefit = Math.max(1, ...rows.map((r) => Math.abs(r.netBenefitKrw ?? 0)))
  const krw = (v: number | null | undefined) =>
    v == null ? '–' : <span title={formatKrwFull(v, locale)}>{formatKrwCompact(v, locale)}</span>

  const columns: ResponsiveColumn<CleaningMethodComparison>[] = [
    {
      key: 'method',
      header: t('calc.cleaning.method'),
      mobile: 'title',
      render: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          <span>{r.name}</span>
          {r.maxNetBenefit && (
            <span
              data-testid="badge-max-net-benefit"
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-accent-fg"
            >
              <Award aria-hidden className="size-3.5" />
              {t('calc.cleaning.maxNetBenefit')}
            </span>
          )}
          {!r.available && (
            <span className="text-sm text-status-caution">
              {t('calc.cleaning.unavailable', { missing: (r.missing ?? []).join(', ') })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'cost',
      header: t('calc.cleaning.cost'),
      mobile: 'field',
      align: 'right',
      sortValue: (r) => r.totalInvestmentKrw ?? null,
      render: (r) => krw(r.totalInvestmentKrw),
    },
    {
      key: 'downtime',
      header: t('calc.cleaning.downtime'),
      mobile: 'field',
      align: 'right',
      sortValue: (r) => r.downtimeDays ?? null,
      render: (r) => (r.downtimeDays == null ? '–' : t('calc.cleaning.days', { value: formatNumber(r.downtimeDays, locale) })),
    },
    {
      key: 'recovery',
      header: t('calc.cleaning.recovery'),
      mobile: 'field',
      align: 'right',
      sortValue: (r) => r.expectedRecoveryPct ?? null,
      render: (r) =>
        r.expectedRecoveryPct == null ? '–' : `${formatNumber(r.expectedRecoveryPct, locale, { maximumFractionDigits: 0 })}%`,
    },
    {
      key: 'payback',
      header: t('calc.cleaning.payback'),
      mobile: 'field',
      align: 'right',
      sortValue: (r) => r.paybackMonths ?? null,
      render: (r) =>
        r.paybackMonths == null
          ? t('calc.cleaning.na')
          : t('calc.cleaning.months', {
              value: formatNumber(r.paybackMonths, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            }),
    },
    {
      key: 'netBenefit',
      header: t('calc.cleaning.netBenefit'),
      mobile: 'field',
      align: 'right',
      sortValue: (r) => r.netBenefitKrw ?? null,
      render: (r) => {
        const v = r.netBenefitKrw
        if (v == null) return '–'
        return (
          <span className="inline-flex w-full flex-col items-end gap-1">
            <span title={formatKrwFull(v, locale)} className={cn(v < 0 && 'text-status-danger')}>
              {formatKrwCompact(v, locale)}
            </span>
            <span aria-hidden className="block h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-surface-2">
              <span
                className={cn('block h-full rounded-full', v < 0 ? 'bg-status-danger' : 'bg-status-normal')}
                style={{ width: `${(Math.abs(v) / maxAbsBenefit) * 100}%` }}
              />
            </span>
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-3">
      <ResponsiveTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.methodId}
        caption={t('calc.cleaning.title')}
        defaultSort={{ key: 'netBenefit', dir: 'desc' }}
      />
      <p className="text-sm text-muted">{t('calc.cleaning.caption')}</p>
    </div>
  )
}
