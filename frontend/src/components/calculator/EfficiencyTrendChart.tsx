import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { prefersReducedMotion, withAlpha } from '../../lib/echarts'
import { formatNumber } from '../../lib/format'
import { type EfficiencySummary, efficiencyTrend, TREND_MONTHS } from '../../lib/performance'
import { niceCeil, niceFloor } from '../../lib/thresholds'
import { useUiStore } from '../../store/ui'
import { useThemeColors } from '../../theme/useThemeColors'
import { EChart } from './EChart'

/** 월별 열회수 효율 추이(추정) + 주의 기준선 + 세정 후 회복점 */
export function EfficiencyTrendChart({ summary }: { summary: EfficiencySummary }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const colors = useThemeColors()
  const pct = (v: number) => `${formatNumber(v, locale, { maximumFractionDigits: 1 })}%`

  const option = useMemo<EChartsOption>(() => {
    const trend = efficiencyTrend(summary)
    const labels = [
      ...trend.map((_, m) => (m === 0 ? t('calc.efficiency.design') : t('calc.efficiency.month', { value: m }))),
      t('calc.efficiency.after'),
    ]
    const all = [...trend, summary.afterCleaning, ...(summary.caution != null ? [summary.caution] : [])]
    const min = niceFloor(Math.min(...all) - 1, 1)
    const max = niceCeil(Math.max(...all) + 1, 1)

    return {
      animationDuration: prefersReducedMotion() ? 0 : 300,
      grid: { left: 44, right: 16, top: 24, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => (v == null ? '–' : pct(Number(v))),
        backgroundColor: colors.surface,
        borderColor: colors.border,
        textStyle: { color: colors.text },
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLabel: { color: colors.muted, interval: 'auto', hideOverlap: true },
        axisLine: { lineStyle: { color: colors.border } },
      },
      yAxis: {
        type: 'value',
        min,
        max,
        axisLabel: { color: colors.muted, formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: colors.border, type: 'dashed' } },
      },
      series: [
        {
          name: t('calc.efficiency.series'),
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: [...trend, null],
          lineStyle: { color: colors.accent, width: 2 },
          itemStyle: { color: colors.accent },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: withAlpha(colors.accent, 0.28) },
                { offset: 1, color: withAlpha(colors.accent, 0.02) },
              ],
            },
          },
          markLine:
            summary.caution != null
              ? {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { color: colors.caution, type: 'dashed' },
                  label: { formatter: t('calc.efficiency.caution'), color: colors.caution, position: 'insideStartTop' },
                  data: [{ yAxis: summary.caution }],
                }
              : undefined,
        },
        {
          // 현재 → 세정 후 회복 구간
          name: t('calc.efficiency.recovery'),
          type: 'line',
          data: [...Array<null>(TREND_MONTHS), summary.current, summary.afterCleaning],
          symbolSize: 8,
          lineStyle: { color: colors.normal, width: 2, type: 'dashed' },
          itemStyle: { color: colors.normal },
        },
      ],
    }
  }, [summary, colors, locale, t])

  return (
    <div data-testid="efficiency-chart" data-current={summary.current.toFixed(1)} data-after={summary.afterCleaning.toFixed(1)}>
      <EChart
        option={option}
        className="h-[220px] md:h-[260px]"
        ariaLabel={t('calc.efficiency.aria', {
          design: pct(summary.design),
          current: pct(summary.current),
          after: pct(summary.afterCleaning),
        })}
      />
    </div>
  )
}
