import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { SensitivitySeries, ThresholdBand } from '../../api/types'
import { prefersReducedMotion, withAlpha } from '../../lib/echarts'
import { formatNumber } from '../../lib/format'
import { absoluteBand } from '../../lib/thresholds'
import { useUiStore } from '../../store/ui'
import { useThemeColors } from '../../theme/useThemeColors'
import { EChart } from './EChart'

interface TrendChartProps {
  series: SensitivitySeries
  /** 현재 입력의 총 손실 (현재점 표시) */
  currentY: number
  /** 설계 차압 — 주의/위험 구간 밴드 계산용 */
  baseline?: number | null
  band?: ThresholdBand
}

/** ΔP 변화에 따른 총 손실 감도 곡선 + 현재 ΔP 수직 마커 + 주의/위험 구간 배경 밴드 */
export function TrendChart({ series, currentY, baseline, band }: TrendChartProps) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const colors = useThemeColors()
  const fmt = (v: number, digits = 1) => formatNumber(v, locale, { maximumFractionDigits: digits })

  const option = useMemo<EChartsOption>(() => {
    const xs = series.points.map((p) => p.x)
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    const zones = baseline != null && band ? absoluteBand(baseline, band) : null

    return {
      animationDuration: prefersReducedMotion() ? 0 : 300,
      grid: { left: 48, right: 16, top: 28, bottom: 44 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => `${fmt(Number(v), 2)} MW`,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        textStyle: { color: colors.text },
      },
      xAxis: {
        type: 'value',
        min: xMin,
        max: xMax,
        name: t('calc.trend.xAxis'),
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: colors.muted },
        axisLabel: { color: colors.muted },
        axisLine: { lineStyle: { color: colors.border } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: t('calc.trend.yAxis'),
        nameTextStyle: { color: colors.muted, align: 'left' },
        axisLabel: { color: colors.muted },
        splitLine: { lineStyle: { color: colors.border } },
      },
      series: [
        {
          type: 'line',
          data: series.points.map((p) => [p.x, p.y]),
          showSymbol: false,
          lineStyle: { color: colors.accent, width: 2 },
          itemStyle: { color: colors.accent },
          markArea: zones
            ? {
                silent: true,
                data: [
                  [
                    {
                      xAxis: Math.min(zones.caution, xMax),
                      itemStyle: { color: withAlpha(colors.caution, 0.12) },
                      label: { show: true, position: 'insideTop', color: colors.caution, formatter: t('calc.trend.caution') },
                    },
                    { xAxis: Math.min(zones.danger, xMax) },
                  ],
                  [
                    {
                      xAxis: Math.min(zones.danger, xMax),
                      itemStyle: { color: withAlpha(colors.danger, 0.12) },
                      label: { show: true, position: 'insideTop', color: colors.danger, formatter: t('calc.trend.danger') },
                    },
                    { xAxis: xMax },
                  ],
                ],
              }
            : undefined,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: colors.text, type: 'dashed' },
            label: { formatter: t('calc.trend.current'), color: colors.text },
            data: [{ xAxis: series.currentX }],
          },
          markPoint: {
            symbol: 'circle',
            symbolSize: 10,
            itemStyle: { color: colors.accent, borderColor: colors.surface, borderWidth: 2 },
            label: { show: false },
            data: [{ name: 'current', coord: [series.currentX, currentY] }],
          },
        },
      ],
    }
  }, [series, currentY, baseline, band, colors, locale, t])

  return (
    <div data-testid="trend-chart" data-current-x={series.currentX} data-current-y={currentY}>
      <EChart
        option={option}
        className="h-[220px] md:h-[260px] lg:h-[300px]"
        ariaLabel={t('calc.trend.aria', { x: fmt(series.currentX), y: fmt(currentY, 2) })}
      />
    </div>
  )
}
