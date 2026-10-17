import { SendHorizontal } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessage } from '../../store/chat'
import { MessageBubble, type MessageContext } from './MessageBubble'

interface Props {
  messages: ChatMessage[]
  ctx: MessageContext
  suggestions: string[]
  onAsk: (text: string) => void
}

/**
 * 대화 목록 + 입력창 (PRD §3.2).
 * 입력창은 하단 고정(모바일: 탭바 위). 새 메시지가 오면 마지막 메시지가 보이도록 스크롤한다(V-06).
 */
export function ChatWindow({ messages, ctx, suggestions, onAsk }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const busy = messages.some((m) => m.role === 'assistant' && m.status === 'pending')

  const lastStatus = messages.at(-1)?.role === 'assistant' ? (messages.at(-1) as { status: string }).status : ''
  useEffect(() => {
    if (!messages.length) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' })
  }, [messages.length, lastStatus])

  // 입력창 높이를 내용에 맞춘다(최대 6줄 정도)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  const submit = (value = text) => {
    if (!value.trim() || busy) return
    onAsk(value)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 조합 중 Enter는 글자 확정용이므로 전송하지 않는다
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="log" aria-live="polite" aria-label={t('chat.log')} className="flex-1 space-y-6 pb-4">
        {messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">
            {t('chat.empty')}
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} ctx={ctx} />
        ))}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 space-y-2 border-t border-border bg-bg/95 px-4 pt-3 pb-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-t-xl lg:border-x lg:px-4">
        {suggestions.length > 0 && (
          <ul aria-label={t('chat.suggestions.label')} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {suggestions.map((s) => (
              <li key={s} className="shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit(s)}
                  className="min-h-11 rounded-full border border-border bg-surface px-3 text-sm whitespace-nowrap hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            submit()
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="chat-input" className="sr-only">
            {t('chat.input.label')}
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('chat.input.placeholder')}
            aria-description={t('chat.input.hint')}
            title={t('chat.input.hint')}
            enterKeyHint="send"
            className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-accent"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label={t('chat.input.send')}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <SendHorizontal aria-hidden className="size-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
