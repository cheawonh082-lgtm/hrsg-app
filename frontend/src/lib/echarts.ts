// 필요한 모듈만 등록해 번들 크기를 줄인다
import { GaugeChart, LineChart, PieChart } from 'echarts/charts'
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
  PieChart,
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

/**
 * 툴팁을 body에 붙이고 화면(viewport) 안에 들어오도록 위치를 잡는다.
 * 작은 차트나 overflow가 있는 카드 안에서도 잘리지 않게 — 오른쪽·아래가 모자라면 커서 반대편으로 뒤집는다.
 * anchor: 차트를 감싼 요소 (ECharts가 넘겨주는 좌표가 이 요소 기준)
 */
export function viewportTooltip(anchor: () => HTMLElement | null) {
  const GAP = 12
  const MARGIN = 8
  return {
    appendTo: 'body',
    position: (point: number[], _params: unknown, _dom: unknown, _rect: unknown, size: { contentSize: number[] }) => {
      const box = anchor()?.getBoundingClientRect()
      if (!box) return point
      const [w, h] = size.contentSize
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      let x = point[0] + GAP
      let y = point[1] + GAP
      if (box.left + x + w > vw - MARGIN) x = point[0] - GAP - w
      if (box.top + y + h > vh - MARGIN) y = point[1] - GAP - h
      x = Math.min(Math.max(x, MARGIN - box.left), vw - MARGIN - w - box.left)
      y = Math.min(Math.max(y, MARGIN - box.top), vh - MARGIN - h - box.top)
      return [x, y]
    },
  } as const
}
