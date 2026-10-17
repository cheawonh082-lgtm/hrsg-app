// 필요한 모듈만 등록해 번들 크기를 줄인다
import { GaugeChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  GaugeChart,
  LineChart,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  CanvasRenderer,
])

export { echarts }

/** '#rrggbb' + 투명도 → '#rrggbbaa' (테마 토큰은 모두 6자리 hex) */
export function withAlpha(hex: string, alpha: number) {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${a}` : hex
}

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
