import { type RefObject, useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
}

/**
 * 모달 오버레이(BottomSheet·Drawer) 공통 동작 (R-14):
 * Esc 닫기, 포커스 가두기, 배경 스크롤 잠금, 닫힌 뒤 원래 위치로 포커스 복귀.
 */
export function useModalOverlay(open: boolean, onClose: () => void, containerRef: RefObject<HTMLElement | null>) {
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    containerRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current
      if (e.key === 'Escape') {
        e.stopPropagation()
        close.current()
      } else if (e.key === 'Tab' && container) {
        const items = focusables(container)
        if (items.length === 0) return e.preventDefault()
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === container)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [open, containerRef])
}
