import { useTranslation } from 'react-i18next'

import type { CalcResult } from '../../api/types'
import { cn } from '../../lib/cn'
import { formatKrwCompact, formatKrwFull, formatNumber } from '../../lib/format'
import type { Locale } from '../../store/ui'
import { KpiCard } from './KpiCard'

/** 계산 결과 핵심 지표 4개 (총 손실·연간 손실액·세정 시 연간 회수·종합 상태) — 계산기·홈 공용 */
export function KpiRow({
  result,
  previous,
  pending,
  locale,
  className = 'grid grid-cols-2 gap-3 xl:grid-cols-4',
}: {
  result?: CalcResult
  previous?: CalcResult
  pending: boolean
  locale: Locale
  className?: string
}) {
  const { t } = useTranslation()
  const mw = (v: number) => formatNumber(v, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const krw = (v: number) => formatKrwCompact(v, locale)
  const vsPrevious = t('calc.kpi.vsPrevious')

  return (
    // 기본: 4열은 카드 폭이 충분한 xl부터 (태블릿·좁은 노트북에서는 2×2)
    <div className={cn(className)}>
      <KpiCard
        testId="kpi-totalLoss"
        label={t('calc.kpi.totalLoss')}
        value={result?.loss.totalPowerLossMw}
        format={mw}
        unit="MW"
        delta={previous && result ? result.loss.totalPowerLossMw - previous.loss.totalPowerLossMw : null}
        deltaFormat={mw}
        deltaLabel={vsPrevious}
        loading={pending}
        sub={
          result &&
          t('calc.kpi.breakdown', { gt: mw(result.loss.gtPowerLossMw), st: mw(result.loss.stPowerLossMw) })
        }
      />
      <KpiCard
        testId="kpi-annualLoss"
        label={t('calc.kpi.annualLoss')}
        value={result?.loss.annualRevenueLossKrw}
        format={krw}
        fullValue={result && formatKrwFull(result.loss.annualRevenueLossKrw, locale)}
        delta={previous && result ? result.loss.annualRevenueLossKrw - previous.loss.annualRevenueLossKrw : null}
        deltaFormat={krw}
        deltaLabel={vsPrevious}
        loading={pending}
      />
      <KpiCard
        testId="kpi-annualRecovery"
        label={t('calc.kpi.annualRecovery')}
        value={result?.recovery.annualRecoveryKrw}
        format={krw}
        fullValue={result && formatKrwFull(result.recovery.annualRecoveryKrw, locale)}
        higherIsWorse={false}
        loading={pending}
        sub={
          result &&
          t('calc.kpi.recoveryRate', { value: formatNumber(result.recovery.recoveryRatePct, locale, { maximumFractionDigits: 0 }) })
        }
      />
      <KpiCard
        testId="kpi-status"
        label={t('calc.kpi.overallStatus')}
        value={result?.current.foulingIndex}
        format={(v) => formatNumber(Math.round(v), locale)}
        unit={t('calc.kpi.foulingIndexUnit')}
        status={result?.current.overallStatus}
        loading={pending}
      />
    </div>
  )
}
