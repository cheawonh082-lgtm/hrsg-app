import { X } from 'lucide-react'
import { type ReactNode, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useModalOverlay } from '../../hooks/useModalOverlay'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** 하단 고정 버튼 영역 */
  footer?: ReactNode
}

/**
 * 대화상자 (PRD §3.4.2 체크리스트 이메일 복사): 모바일(md 미만)은 전체 화면, md 이상은 가운데 모달.
 * Esc·배경 클릭·닫기 버튼으로 닫힘, 배경 스크롤 잠금·포커스 가두기(R-14)는 BottomSheet·Drawer와 같은 훅 사용.
 */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useModalOverlay(open, onClose, panelRef)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-6">
      <div aria-hidden className="absolute inset-0 bg-black/40 transition-opacity starting:opacity-0" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-dvh w-full flex-col bg-surface pt-[env(safe-area-inset-top)] outline-none md:h-auto md:max-h-[90dvh] md:max-w-2xl md:rounded-2xl md:border md:border-border md:pt-0 md:shadow-2xl"
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
