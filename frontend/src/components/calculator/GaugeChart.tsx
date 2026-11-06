import type { EChartsOption } from 'echarts'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Metric } from '../../api/types'
import { cn } from '../../lib/cn'
import { prefersReducedMotion } from '../../lib/echarts'
import { formatNumber } from '../../lib/format'
import { clamp } from '../../lib/thresholds'
import { useUiStore } from '../../store/ui'
import { useThemeColors } from '../../theme/useThemeColors'
import { StatusPill } from '../common/StatusPill'
import { EChart } from './EChart'

/** 게이지로 보여줄 지표 (키트 r.indicators — 값·설계·주의·위험·min·max·level) */
const GAUGES = ['gtBackPressure', 'hrsgGasDp', 'stackTemp'] as const
type GaugeKey = (typeof GAUGES)[number]

export function GaugeChart({ metric }: { metric: Metric }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const colors = useThemeColors()
  const label = t(`calc.metrics.${metric.key}`)
  const baseline = metric.baseline ?? metric.value
  const fmt = (v: number) => formatNumber(v, locale, { maximumFractionDigits: 1 })

  const option = useMemo<EChartsOption>(() => {
    // 키트 지표의 판정 기준(절대값)을 게이지 구간 색으로 — 프론트에 기준값 하드코딩 없음
    const caution = metric.caution ?? baseline
    const danger = metric.danger ?? caution
    const min = Math.min(metric.min ?? baseline, metric.value)
    const max = Math.max(metric.max ?? danger, metric.value)
    const frac = (x: number) => clamp((x - min) / (max - min || 1), 0, 1)

    return {
      animationDuration: prefersReducedMotion() ? 0 : 300,
      series: [
        {
          type: 'gauge',
          min,
          max,
          startAngle: 210,
          endAngle: -30,
          radius: '92%',
          center: ['50%', '58%'],
          axisLine: {
            lineStyle: {
              width: 12,
              color: [
                [frac(caution), colors.normal],
                [frac(danger), colors.caution],
                [1, colors.danger],
              ],
            },
          },
          pointer: { width: 5, length: '58%', itemStyle: { color: colors.text } },
          anchor: { show: true, size: 10, itemStyle: { color: colors.text } },
          axisTick: { distance: -12, length: 5, lineStyle: { color: colors.surface, width: 1 } },
          splitLine: { distance: -12, length: 12, lineStyle: { color: colors.surface, width: 2 } },
          splitNumber: 5,
          axisLabel: { distance: 16, color: colors.muted, fontSize: 10, formatter: (v: number) => fmt(v) },
          title: { show: false },
          detail: {
            valueAnimation: !prefersReducedMotion(),
            formatter: (v: number) => `${fmt(v)} ${metric.unit}`,
            color: colors.text,
            fontSize: 18,
            fontWeight: 600,
            offsetCenter: [0, '42%'],
          },
          data: [{ value: metric.value }],
        },
      ],
    }
  }, [metric, baseline, colors, locale])

  return (
    <figure
      data-testid={`gauge-${metric.key}`}
      data-value={metric.value}
      data-status={metric.status}
      className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-surface p-3"
    >
      <figcaption className="flex items-center justify-between gap-2">
        <span className="min-w-0 font-medium">{label}</span>
        {metric.status && <StatusPill status={metric.status} size="sm" />}
      </figcaption>
      <EChart
        option={option}
        className="h-44"
        ariaLabel={t('calc.gauge.aria', { label, value: fmt(metric.value), unit: metric.unit, design: fmt(baseline) })}
      />
      <p className="text-center text-sm text-muted tabular-nums">
        {t('calc.gauge.design', { value: fmt(baseline), unit: metric.unit })}
      </p>
    </figure>
  )
}

/** 게이지 3종. 모바일은 가로 스와이프(스크롤 스냅 + 페이지 점), md 이상은 3열 (PRD §3.4.2) */
export function GaugeGroup({ metrics }: { metrics: Metric[] }) {
  const { t } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const items = GAUGES.map((key) => ({ key, metric: metrics.find((m) => m.key === key) })).filter(
    (x): x is { key: GaugeKey; metric: Metric } => !!x.metric,
  )

  const pageWidth = () => {
    const el = scroller.current
    const first = el?.firstElementChild as HTMLElement | null
    return first ? first.offsetWidth + 12 /* gap-3 */ : 1
  }

  return (
    <div>
      <div
        ref={scroller}
        onScroll={() => scroller.current && setIndex(Math.round(scroller.current.scrollLeft / pageWidth()))}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible"
      >
        {items.map(({ key, metric }) => (
          <div key={key} className="w-full shrink-0 snap-center md:w-auto md:min-w-0">
            <GaugeChart metric={metric} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-center md:hidden">
        {items.map(({ key }, i) => (
          <button
            key={key}
            type="button"
            aria-label={t('calc.gauge.page', { index: i + 1, label: t(`calc.metrics.${key}`) })}
            aria-current={i === index}
            onClick={() => scroller.current?.scrollTo({ left: i * pageWidth(), behavior: 'smooth' })}
            className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span aria-hidden className={cn('size-2 rounded-full', i === index ? 'bg-accent' : 'bg-border')} />
          </button>
        ))}
      </div>
    </div>
  )
}
