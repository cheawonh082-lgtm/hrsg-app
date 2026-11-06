import { useTranslation } from 'react-i18next'

import type { CalcResult } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { useUiStore } from '../../store/ui'

/** 현재 손실(GT·ST 분해) vs 기본 공법 세정 후 손실(키트 r.default_method.loss_after) — 막대 폭은 현재 총 손실 기준 */
export function LossComparison({ result }: { result: CalcResult }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const mw = (v: number) => `${formatNumber(v, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MW`

  const { gtPowerLossMw: gt, stPowerLossMw: st, totalPowerLossMw: total } = result.loss
  const recovered = result.recovery.recoveredPowerMw
  const after = result.recovery.lossAfterMw
  const pct = (v: number) => `${total > 0 ? (v / total) * 100 : 0}%`

  const rows = [
    {
      key: 'current',
      value: total,
      bar: (
        <>
          <span className="bg-tone-blue" style={{ width: pct(gt) }} />
          <span className="bg-tone-brown" style={{ width: pct(st) }} />
        </>
      ),
    },
    { key: 'after', value: after, bar: <span className="bg-status-normal" style={{ width: pct(after) }} /> },
  ] as const

  return (
    <div data-testid="loss-comparison" className="space-y-3">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3">
        {rows.map((r) => (
          <div key={r.key} data-testid={`loss-${r.key}`} className="contents">
            <dt className="text-sm whitespace-nowrap">{t(`calc.lossCompare.${r.key}`)}</dt>
            <dd aria-hidden className="flex h-6 overflow-hidden rounded-md bg-surface-2 [&>span]:transition-[width]">
              {r.bar}
            </dd>
            <dd className="text-right font-semibold whitespace-nowrap tabular-nums">{mw(r.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <Legend className="bg-tone-blue" label="GT" />
        <Legend className="bg-tone-brown" label="ST" />
        <span>· {t('calc.lossCompare.basis', { value: mw(recovered) })}</span>
      </p>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-3 rounded-sm ${className}`} />
      {label}
    </span>
  )
}
