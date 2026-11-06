import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { prefersReducedMotion, withAlpha } from '../../lib/echarts'
import type { EfficiencyEstimate } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { niceCeil, niceFloor } from '../../lib/thresholds'
import { useUiStore } from '../../store/ui'
import { useThemeColors } from '../../theme/useThemeColors'
import { EChart } from './EChart'

/** 효율이 있는(배기·외기 온도가 입력된) 결과 */
export type KnownEfficiency = EfficiencyEstimate & { currentPct: number; afterCleaningPct: number; designPct: number }

export function hasEfficiency(e: EfficiencyEstimate): e is KnownEfficiency {
  return e.currentPct != null && e.afterCleaningPct != null && e.designPct != null
}

/** 월별 열회수 효율 추이(키트 efficiency_trend: 13개 점 + 세정 후) + 주의 기준선 + 세정 후 회복점 */
export function EfficiencyTrendChart({ efficiency }: { efficiency: KnownEfficiency }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const colors = useThemeColors()
  const pct = (v: number) => `${formatNumber(v, locale, { maximumFractionDigits: 1 })}%`

  const option = useMemo<EChartsOption>(() => {
    const trend = efficiency.trend.map((p) => p.y)
    const months = efficiency.trend.length - 1
    const caution = efficiency.cautionPct
    const labels = [
      ...efficiency.trend.map((p) => (p.x === 0 ? t('calc.efficiency.design') : t('calc.efficiency.month', { value: p.x }))),
      t('calc.efficiency.after'),
    ]
    const all = [...trend, efficiency.afterCleaningPct, ...(caution != null ? [caution] : [])]
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
            caution != null
              ? {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { color: colors.caution, type: 'dashed' },
                  label: { formatter: t('calc.efficiency.caution'), color: colors.caution, position: 'insideStartTop' },
                  data: [{ yAxis: caution }],
                }
              : undefined,
        },
        {
          // 현재 → 세정 후 회복 구간
          name: t('calc.efficiency.recovery'),
          type: 'line',
          data: [...Array<null>(months), efficiency.currentPct, efficiency.afterCleaningPct],
          symbolSize: 8,
          lineStyle: { color: colors.normal, width: 2, type: 'dashed' },
          itemStyle: { color: colors.normal },
        },
      ],
    }
  }, [efficiency, colors, locale, t])

  return (
    <div
      data-testid="efficiency-chart"
      data-points={efficiency.trend.length}
      data-design={efficiency.designPct.toFixed(1)}
      data-current={efficiency.currentPct.toFixed(1)}
      data-after={efficiency.afterCleaningPct.toFixed(1)}
    >
      <EChart
        option={option}
        className="h-[220px] md:h-[260px]"
        ariaLabel={t('calc.efficiency.aria', {
          design: pct(efficiency.designPct),
          current: pct(efficiency.currentPct),
          after: pct(efficiency.afterCleaningPct),
        })}
      />
    </div>
  )
}
