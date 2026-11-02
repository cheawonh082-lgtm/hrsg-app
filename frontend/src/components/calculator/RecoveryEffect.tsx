import { useTranslation } from 'react-i18next'

import type { CalcResult } from '../../api/types'
import { formatKrwCompact, formatNumber } from '../../lib/format'
import { type EfficiencySummary, TREND_MONTHS } from '../../lib/performance'
import { useUiStore } from '../../store/ui'
import { EfficiencyTrendChart } from './EfficiencyTrendChart'

/** 세정 시 회수효과 — 효율·출력·금액 요약 + 열회수 효율 추이 */
export function RecoveryEffect({ result, summary }: { result: CalcResult; summary: EfficiencySummary }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const pct = (v: number) => `${formatNumber(v, locale, { maximumFractionDigits: 1 })}%`

  const stats = [
    { key: 'currentEff', value: pct(summary.current) },
    { key: 'afterEff', value: pct(summary.afterCleaning), good: true },
    {
      key: 'recoveredPower',
      value: `+${formatNumber(result.recovery.recoveredPowerMw, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MW`,
      good: true,
    },
    { key: 'annualRecovery', value: formatKrwCompact(result.recovery.annualRecoveryKrw, locale), good: true },
  ]

  return (
    <div data-testid="recovery-effect" className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="min-w-0 rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">{t(`calc.recoveryEffect.${s.key}`)}</dt>
            <dd className={`text-lg font-semibold whitespace-nowrap tabular-nums ${s.good ? 'text-status-normal' : ''}`}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <div>
        <h3 className="font-semibold">{t('calc.efficiency.title')}</h3>
        <p className="text-sm text-muted">{t('calc.efficiency.subtitle')}</p>
        <EfficiencyTrendChart summary={summary} />
        <p className="text-xs text-muted">{t('calc.efficiency.note', { months: TREND_MONTHS })}</p>
      </div>
    </div>
  )
}
