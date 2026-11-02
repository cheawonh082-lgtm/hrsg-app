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
import { type EfficiencySummary, representativeMethod } from '../../lib/performance'
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

/** 핵심 성능 지표 — 종합 상태 + 지표 카드 9개. 카드 색은 상태(정상·주의·위험)를 따른다 */
export function PerformanceKpiGrid({ result, efficiency }: { result: CalcResult; efficiency: EfficiencySummary }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const num = (v: number, digits = 1) => formatNumber(v, locale, { maximumFractionDigits: digits })
  const signed = (v: number, digits = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), digits)}`
  const vsDesign = (v: string) => t('calc.perf.vsDesign', { value: v })

  const hp = result.pinchApproach.find((p) => p.section === 'HP')
  const hpTone: Tone = !hp || hp.status === 'insufficient_data' ? 'none' : hp.status
  const steam = result.current.metrics.find((m) => m.key === 'hpSteamFlow')
  const toTph = (kgS: number) => kgS * 3.6
  const overall = result.current.overallStatus
  const method = representativeMethod(result.cleaningComparison)
  const payback = method?.paybackMonths
  const periodMonths = (result.input.economics.analysisPeriodYears ?? 1) * 12

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
      value: steam ? num(toTph(steam.value)) : '–',
      unit: 't/h',
      sub: steam?.baseline != null ? vsDesign(`${signed(toTph(steam.value - steam.baseline))} t/h`) : undefined,
      icon: Zap,
      tone: steam?.status ?? 'none',
    },
    {
      key: 'efficiency',
      value: num(efficiency.current),
      unit: '%',
      sub: vsDesign(`${signed(efficiency.current - efficiency.design)}%p`),
      icon: TrendingDown,
      tone: efficiency.status,
    },
    {
      key: 'perfLoss',
      value: signed(-result.loss.totalPowerLossMw),
      unit: 'MW',
      icon: Zap,
      tone: overall,
    },
    {
      key: 'recovery',
      value: signed(result.recovery.recoveredPowerMw),
      unit: 'MW',
      sub: t('calc.perf.recoveryRate', { value: num(result.recovery.recoveryRatePct, 0) }),
      icon: CircleCheck,
      tone: 'normal',
    },
    {
      key: 'annualLoss',
      value: formatKrwCompact(result.loss.annualRevenueLossKrw, locale),
      fullValue: formatKrwFull(result.loss.annualRevenueLossKrw, locale),
      icon: Banknote,
      tone: overall,
    },
    {
      key: 'cleaningCost',
      value: method ? formatKrwCompact(method.costKrw, locale) : '–',
      fullValue: method && formatKrwFull(method.costKrw, locale),
      sub: method && t(method.nameKey),
      icon: Banknote,
      tone: 'normal',
    },
    {
      key: 'payback',
      value: payback != null ? `~${num(payback)}` : t('calc.cleaning.na'),
      unit: payback != null ? t('calc.perf.monthsUnit') : undefined,
      icon: CalendarClock,
      tone: payback == null ? 'none' : payback <= periodMonths ? 'normal' : 'caution',
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
          <span className="text-xs text-muted">{t(`calc.perf.advice.${overall}`)}</span>
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
