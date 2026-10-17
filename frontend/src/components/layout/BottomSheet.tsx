import { X } from 'lucide-react'
import { type PointerEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useModalOverlay } from '../../hooks/useModalOverlay'
import { cn } from '../../lib/cn'

const DRAG_START_PX = 6

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** 시트 상단에 항상 보이는 요약(예: KPI 1줄). 내용을 스크롤해도 고정된다. */
  summary?: ReactNode
  children: ReactNode
  /** 화면 높이 대비 비율. 최대 0.9 (R-14) */
  snapPoints?: [number, number]
  initialSnap?: 0 | 1
}

/**
 * 모바일용 바텀시트 (PRD §3.4.4).
 * - 손잡이·헤더를 끌어 50% / 90% 높이에 맞춤, 아래로 충분히 끌면 닫힘
 * - 손잡이 버튼(키보드)으로 높이 전환, Esc·배경 클릭·닫기 버튼으로 닫기
 */
export function BottomSheet({
  open,
  onClose,
  title,
  summary,
  children,
  snapPoints = [0.5, 0.9],
  initialSnap = 0,
}: BottomSheetProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [snap, setSnap] = useState<0 | 1>(initialSnap)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const drag = useRef<{ pointerId: number; startY: number; startHeight: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  useModalOverlay(open, onClose, panelRef)

  useEffect(() => {
    if (open) setSnap(initialSnap)
  }, [open, initialSnap])

  if (!open) return null

  const viewportHeight = () => window.innerHeight

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!panelRef.current) return
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: panelRef.current.getBoundingClientRect().height,
      moved: false,
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dy = e.clientY - d.startY
    if (!d.moved) {
      if (Math.abs(dy) < DRAG_START_PX) return
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const max = viewportHeight() * snapPoints[1]
    setDragHeight(Math.min(max, Math.max(0, d.startHeight - dy)))
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    suppressClick.current = true // 끌기 직후 손잡이 클릭(높이 전환)이 같이 일어나지 않도록
    const ratio = (dragHeight ?? d.startHeight) / viewportHeight()
    setDragHeight(null)
    if (ratio < snapPoints[0] * 0.6) {
      onClose()
      return
    }
    setSnap(Math.abs(ratio - snapPoints[0]) <= Math.abs(ratio - snapPoints[1]) ? 0 : 1)
  }

  const toggleSnap = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    setSnap((s) => (s === 0 ? 1 : 0))
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="absolute inset-0 bg-black/40 transition-opacity starting:opacity-0" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-snap={snap}
        style={{ height: dragHeight ?? `${snapPoints[snap] * 100}dvh` }}
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[90dvh] translate-y-0 flex-col rounded-t-2xl border-t border-border bg-surface shadow-2xl outline-none',
          'starting:translate-y-full',
          dragHeight == null && 'transition-[height,translate] duration-200 ease-out',
        )}
      >
        {/* 끌기 영역: 손잡이 + 제목 + 요약 */}
        <div
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <button
            type="button"
            onClick={toggleSnap}
            aria-label={t('overlay.resize')}
            className="flex h-6 w-full items-center justify-center focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
          </button>
          <div className="flex items-center gap-2 px-4 pb-2">
            <h2 id={titleId} className="min-w-0 flex-1 text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('overlay.close')}
              className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {summary && <div className="border-y border-border bg-surface-2 px-4 py-2">{summary}</div>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
