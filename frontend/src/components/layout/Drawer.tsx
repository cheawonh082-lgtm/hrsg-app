import { X } from 'lucide-react'
import { type ReactNode, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useModalOverlay } from '../../hooks/useModalOverlay'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** 좌측 슬라이드 패널 (모바일·태블릿의 대화 목록·메뉴용, PRD §3.4.4). Esc·배경 클릭으로 닫힘. */
export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useModalOverlay(open, onClose, panelRef)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="absolute inset-0 bg-black/40 transition-opacity starting:opacity-0" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-[min(85vw,20rem)] translate-x-0 flex-col border-r border-border bg-surface pt-[env(safe-area-inset-top)] shadow-2xl outline-none transition-transform duration-200 ease-out starting:-translate-x-full"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
