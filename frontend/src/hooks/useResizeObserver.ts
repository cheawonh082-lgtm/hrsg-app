import { type RefObject, useEffect, useRef } from 'react'

/** 요소 크기가 바뀌면(창 크기·회전·사이드바 접기 등) 디바운스 후 콜백 호출 (R-6) */
export function useResizeObserver(ref: RefObject<HTMLElement | null>, onResize: () => void, debounceMs = 100) {
  const callback = useRef(onResize)
  callback.current = onResize

  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return
    let timer = 0
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => callback.current(), debounceMs)
    })
    observer.observe(node)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [ref, debounceMs])
}
