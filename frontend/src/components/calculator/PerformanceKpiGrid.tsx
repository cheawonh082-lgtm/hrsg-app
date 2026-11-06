import {
  Banknote,
  CalendarClock,
  CircleCheck,
  type LucideIcon,
  OctagonAlert,
  Thermometer,
  TrendingDown,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { CalcResult, StatusLevel } from '../../api/types'
import { cn } from '../../lib/cn'
import { formatKrwCompact, formatKrwFull, formatNumber } from '../../lib/format'
import { useUiStore } from '../../store/ui'
import { StatusPill } from '../common/StatusPill'

type Tone = StatusLevel | 'none'

const TONE: Record<Tone, { border: string; text: string; icon: string }> = {
  normal: { border: 'border-l-status-normal', text: 'text-status-normal', icon: 'bg-status-normal/10 text-status-normal' },
  caution: { border: 'border-l-status-caution', text: 'text-status-caution', icon: 'bg-status-caution/10 text-status-caution' },
  danger: { border: 'border-l-status-danger', text: 'text-status-danger', icon: 'bg-status-danger/10 text-status-danger' },
  none: { border: 'border-l-border', text: 'text-text', icon: 'bg-surface-2 text-muted' },
}

const OVERALL_ICON: Record<StatusLevel, LucideIcon> = { normal: CircleCheck, caution: TriangleAlert, danger: OctagonAlert }

interface Card {
  key: string
  value: string
  unit?: string
  fullValue?: string
  sub?: string
  icon: LucideIcon
  tone: Tone
}

/**
 * 핵심 성능 지표 — 키트 key_indicators(): 종합 상태 + 지표 카드 9개. 카드 색은 키트 판정(정상·주의·위험)을 따르고,
 * 판정이 없는 값(스팀·세정 비용·회수기간)은 중립색이다.
 */
export function PerformanceKpiGrid({ result }: { result: CalcResult }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const num = (v: number, digits = 1) =>
    formatNumber(v, locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  // 부호는 반올림한 값 기준 (−0.04 → "0.0", "−0.0"이 아니라)
  const signed = (v: number, digits = 1) => {
    const r = Math.round(v * 10 ** digits) / 10 ** digits
    return `${r > 0 ? '+' : r < 0 ? '−' : ''}${num(Math.abs(r), digits)}`
  }
  const vsDesign = (v: string) => t('calc.perf.vsDesign', { value: v })

  const k = result.keyIndicators
  const hp = result.pinchApproach.find((p) => p.section === 'HP')
  const hpTone: Tone = !hp || hp.status === 'insufficient_data' ? 'none' : hp.status
  const eff = result.efficiency
  const effTone: Tone = eff.status === 'no_data' ? 'none' : eff.status
  const lossTone: Tone = result.current.overallStatus
  const overall = k.overallStatus
  const payback = k.paybackMonths

  const cards: Card[] = [
    {
      key: 'hpPinch',
      value: hp?.pinchC != null ? num(hp.pinchC) : '–',
      unit: '℃',
      sub: hp?.pinchC != null ? vsDesign(`${signed(hp.pinchC - hp.designPinchC)}℃`) : undefined,
      icon: Thermometer,
      tone: hpTone,
    },
    {
      key: 'hpApproach',
      value: hp?.approachC != null ? num(hp.approachC) : '–',
      unit: '℃',
      sub: hp?.approachC != null ? vsDesign(`${signed(hp.approachC - hp.designApproachC)}℃`) : undefined,
      icon: Thermometer,
      tone: hpTone,
    },
    {
      key: 'steam',
      value: k.hpSteamTph != null ? formatNumber(k.hpSteamTph, locale, { maximumFractionDigits: 1 }) : '–',
      unit: 't/h',
      icon: Zap,
      tone: 'none',
    },
    {
      key: 'efficiency',
      value: eff.currentPct != null ? num(eff.currentPct) : '–',
      unit: '%',
      sub: eff.vsDesignPp != null ? t('calc.perf.vsDesignPp', { value: signed(eff.vsDesignPp, 2) }) : undefined,
      icon: TrendingDown,
      tone: effTone,
    },
    {
      key: 'perfLoss',
      value: num(result.loss.totalPowerLossMw, 2),
      unit: 'MW',
      icon: Zap,
      tone: lossTone,
    },
    {
      key: 'recovery',
      value: num(result.recovery.recoveredPowerMw, 2),
      unit: 'MW',
      sub: t('calc.perf.recoveryRate', { value: formatNumber(result.recovery.recoveryRatePct, locale, { maximumFractionDigits: 0 }) }),
      icon: CircleCheck,
      tone: 'normal',
    },
    {
      key: 'annualLoss',
      value: formatKrwCompact(result.loss.annualRevenueLossKrw, locale),
      fullValue: formatKrwFull(result.loss.annualRevenueLossKrw, locale),
      icon: Banknote,
      tone: lossTone,
    },
    {
      key: 'cleaningCost',
      value: k.cleaningCostKrw != null ? formatKrwCompact(k.cleaningCostKrw, locale) : t('calc.cleaning.na'),
      fullValue: k.cleaningCostKrw != null ? formatKrwFull(k.cleaningCostKrw, locale) : undefined,
      sub: result.recovery.name ?? undefined,
      icon: Banknote,
      tone: 'none',
    },
    {
      key: 'payback',
      value: payback != null ? num(payback, 2) : t('calc.cleaning.na'),
      unit: payback != null ? t('calc.perf.monthsUnit') : undefined,
      icon: CalendarClock,
      tone: 'none',
    },
  ]

  const OverallIcon = OVERALL_ICON[overall]

  return (
    <div className="@container">
      <ul className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-5">
        <li
          data-testid="perf-overall"
          data-status={overall}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border border-l-4 border-border bg-surface p-4 text-center @sm:col-span-2 @2xl:col-span-1 @2xl:row-span-2 @5xl:row-span-1',
            TONE[overall].border,
          )}
        >
          <span className="text-sm text-muted">{t('calc.perf.overall')}</span>
          <span className={cn('flex size-14 items-center justify-center rounded-full', TONE[overall].icon)}>
            <OverallIcon aria-hidden className="size-7" />
          </span>
          <span className={cn('text-lg font-bold', TONE[overall].text)}>{t(`status.${overall}`)}</span>
          <span data-testid="perf-overall-text" className="text-xs text-muted">{t(`calc.perf.advice.${overall}`)}</span>
        </li>

        {cards.map((c) => (
          <li
            key={c.key}
            data-testid={`perf-${c.key}`}
            data-status={c.tone}
            className={cn(
              'flex min-w-0 flex-col gap-1 rounded-xl border border-l-4 border-border bg-surface p-4',
              TONE[c.tone].border,
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-sm text-muted">{t(`calc.perf.${c.key}`)}</span>
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', TONE[c.tone].icon)}>
                <c.icon aria-hidden className="size-5" />
              </span>
            </div>
            <p className="flex min-w-0 items-baseline gap-1" title={c.fullValue}>
              <span className={cn('text-2xl font-bold whitespace-nowrap tabular-nums', TONE[c.tone].text)}>{c.value}</span>
              {c.unit && <span className="text-sm text-muted">{c.unit}</span>}
            </p>
            {c.sub && <p className="text-xs text-muted tabular-nums">{c.sub}</p>}
            {c.tone !== 'none' && <StatusPill status={c.tone} size="sm" className="mt-auto self-start" />}
          </li>
        ))}
      </ul>
    </div>
  )
}
