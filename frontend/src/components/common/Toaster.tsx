import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '../../lib/cn'
import { useToastStore } from '../../store/toast'

const ICON = { success: CircleCheck, info: Info, error: CircleAlert } as const

/** 토스트 표시 영역. 모바일은 하단 탭바 위, lg 이상은 오른쪽 아래. */
export function Toaster() {
  const { t } = useTranslation()
  const { toasts, dismiss } = useToastStore()

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end"
    >
      {toasts.map((toast) => {
        const Icon = ICON[toast.tone]
        return (
          <div
            key={toast.id}
            data-testid="toast"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl border bg-surface px-4 py-2 shadow-lg transition starting:translate-y-2 starting:opacity-0',
              toast.tone === 'error' ? 'border-status-danger/50' : 'border-border',
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                'size-5 shrink-0',
                toast.tone === 'success' && 'text-status-normal',
                toast.tone === 'error' && 'text-status-danger',
                toast.tone === 'info' && 'text-accent',
              )}
            />
            <span className="min-w-0 flex-1 text-sm">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t('overlay.close')}
              className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
