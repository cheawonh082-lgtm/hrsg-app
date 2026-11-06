import type { EChartsOption } from 'echarts'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { CleaningMethodComparison } from '../../api/types'
import { prefersReducedMotion, viewportTooltip } from '../../lib/echarts'
import { formatKrwCompact, formatNumber } from '../../lib/format'
import { useUiStore } from '../../store/ui'
import { useThemeColors } from '../../theme/useThemeColors'
import { EChart } from '../calculator/EChart'

/** 세정 공법별 비용(총투자) 비율 도넛 + 범례(공법·비율) — 홈 대시보드 */
export function CleaningCostDonut({ rows: all }: { rows: CleaningMethodComparison[] }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const colors = useThemeColors()
  const chartBox = useRef<HTMLDivElement>(null)
  const palette = useMemo(
    () => [colors.toneBlue, colors.tonePurple, colors.toneGreen, colors.muted, colors.caution],
    [colors],
  )
  const rows = all.filter((r) => r.totalInvestmentKrw != null) as (CleaningMethodComparison & { totalInvestmentKrw: number })[]
  const total = rows.reduce((sum, r) => sum + r.totalInvestmentKrw, 0)
  const pct = (v: number) => (total ? (v / total) * 100 : 0)

  const option = useMemo<EChartsOption>(
    () => ({
      animationDuration: prefersReducedMotion() ? 0 : 400,
      tooltip: {
        trigger: 'item',
        valueFormatter: (v) => formatKrwCompact(Number(v), locale),
        // 차트가 작아 툴팁이 카드·화면 밖으로 잘리지 않게
        ...viewportTooltip(() => chartBox.current),
        backgroundColor: colors.surface,
        borderColor: colors.border,
        textStyle: { color: colors.text },
      },
      series: [
        {
          type: 'pie',
          radius: ['62%', '88%'],
          padAngle: 2,
          itemStyle: { borderRadius: 6, borderColor: colors.surface, borderWidth: 2 },
          label: { show: false },
          emphasis: { scale: true, scaleSize: 4 },
          data: rows.map((r, i) => ({
            name: r.name,
            value: r.totalInvestmentKrw,
            itemStyle: { color: palette[i % palette.length] },
          })),
        },
      ],
    }),
    [rows, colors, locale, t, palette],
  )

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div ref={chartBox} className="relative size-40 shrink-0">
        <EChart option={option} className="size-40" ariaLabel={t('home.cleaning.chart')} />
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted">{t('home.cleaning.total')}</span>
          <span className="text-lg font-bold tabular-nums">{formatKrwCompact(total, locale)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2.5 text-sm">
        {rows.map((r, i) => (
          <li key={r.methodId} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: palette[i % palette.length] }} />
            <span className="min-w-0 flex-1 truncate" title={r.name}>
              {r.name}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatNumber(pct(r.totalInvestmentKrw), locale, { maximumFractionDigits: 0 })}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
