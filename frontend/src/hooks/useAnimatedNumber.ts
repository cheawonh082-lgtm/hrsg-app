import { useEffect, useRef, useState } from 'react'

import { prefersReducedMotion } from '../lib/echarts'

/** 숫자가 바뀔 때 이전 값에서 새 값으로 부드럽게 이동. 동작 줄이기 설정이면 즉시 바뀐다. */
export function useAnimatedNumber(target: number | null | undefined, duration = 300) {
  const [display, setDisplay] = useState(target)
  const current = useRef(target)

  useEffect(() => {
    const from = current.current
    if (target == null || from == null || from === target || prefersReducedMotion()) {
      current.current = target
      setDisplay(target)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const value = from + (target - from) * (1 - (1 - t) ** 3) // easeOutCubic
      current.current = value
      setDisplay(value)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return display
}
