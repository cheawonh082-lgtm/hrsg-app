import { useEffect, useState } from 'react'

/** 이보다 작은 차이는 주소창 접힘 등으로 보고 키보드로 취급하지 않는다 */
const KEYBOARD_MIN_PX = 80

/**
 * 모바일 가상 키보드가 가리는 높이(px) (PRD §3.4.4 useVisualViewport, R-8).
 * iOS Safari 등은 키보드가 열려도 레이아웃 뷰포트가 줄지 않아 하단 고정 요소가 키보드 뒤로 숨는다.
 * visualViewport(실제 보이는 영역)와 레이아웃 뷰포트의 차이로 키보드 높이를 구한다.
 */
export function keyboardInset(viewport: Pick<VisualViewport, 'height' | 'offsetTop'>, layoutHeight: number) {
  const hidden = Math.round(layoutHeight - viewport.height - viewport.offsetTop)
  return hidden >= KEYBOARD_MIN_PX ? hidden : 0
}

export function useVisualViewport() {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(keyboardInset(vv, window.innerHeight))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return { keyboardInset: inset, keyboardOpen: inset > 0 }
}
