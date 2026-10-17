import type { EChartsOption } from 'echarts'
// lib/(CommonJS)는 Vite에서 default export가 객체로 들어오므로 ESM 빌드를 사용
import ReactEChartsCore from 'echarts-for-react/esm/core'
import { useRef } from 'react'

import { useResizeObserver } from '../../hooks/useResizeObserver'
import { cn } from '../../lib/cn'
import { echarts } from '../../lib/echarts'

interface EChartProps {
  option: EChartsOption
  /** 높이를 반드시 지정 (높이 0 렌더링 방지, R-6) */
  className: string
  ariaLabel: string
}

/** ECharts 공통 래퍼: 부모 크기 변화(창 크기·회전·사이드바)를 ResizeObserver로 감지해 resize() 호출 */
export function EChart({ option, className, ariaLabel }: EChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReactEChartsCore>(null)

  useResizeObserver(wrapperRef, () => chartRef.current?.getEchartsInstance().resize())

  return (
    <div ref={wrapperRef} role="img" aria-label={ariaLabel} className={cn('w-full min-w-0', className)}>
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={option}
        notMerge
        lazyUpdate
        autoResize={false}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}
