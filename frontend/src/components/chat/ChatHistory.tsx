import { MessageSquare, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '../../lib/cn'
import { useChatStore } from '../../store/chat'

interface Props {
  /** 대화를 고르거나 새 대화를 시작한 뒤 호출 (모바일 드로어 닫기) */
  onDone?: () => void
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * 이전 대화 목록 (PRD §3.2 "대화 목록"). PC는 좌측 사이드바, 모바일·태블릿은 드로어 안에 들어간다.
 * 기록은 이 브라우저에만 저장된다.
 */
export function ChatHistory({ onDone }: Props) {
  const { t, i18n } = useTranslation()
  const { conversations, sessionId, select, remove, reset, clearAll } = useChatStore()
  const now = new Date()

  const when = (ts: number) => {
    const d = new Date(ts)
    return isSameDay(d, now)
      ? d.toLocaleTimeString(i18n.language, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : d.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })
  }

  return (
    <div data-testid="chat-history" className="flex min-h-0 flex-1 flex-col gap-3">
      <button
        type="button"
        onClick={() => {
          reset()
          onDone?.()
        }}
        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Plus aria-hidden className="size-4" />
        {t('chat.newChat')}
      </button>

      {conversations.length === 0 ? (
        <p className="px-1 text-sm text-muted">{t('chat.history.empty')}</p>
      ) : (
        <ul
          aria-label={t('chat.history.title')}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain"
        >
          {conversations.map((c) => {
            const active = c.id === sessionId
            return (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    select(c.id)
                    onDone?.()
                  }}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex min-h-11 w-full min-w-0 items-start gap-2 rounded-lg py-2 pr-11 pl-3 text-left text-sm transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-accent',
                    active ? 'bg-tone-blue-bg font-semibold text-accent' : 'hover:bg-surface-2',
                  )}
                >
                  <MessageSquare aria-hidden className="mt-0.5 size-4 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{c.title || t('chat.history.untitled')}</span>
                    <span className="block text-xs font-normal text-muted">{when(c.updatedAt)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label={t('chat.history.delete', { title: c.title })}
                  className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <p className="px-1 text-xs leading-relaxed text-muted">{t('chat.history.localNote')}</p>
        {conversations.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('chat.history.clearConfirm'))) clearAll()
            }}
            className="min-h-11 px-1 text-xs text-muted underline-offset-2 hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {t('chat.history.clearAll')}
          </button>
        )}
      </div>
    </div>
  )
}
