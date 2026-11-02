import { Bot, SendHorizontal } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useVisualViewport } from '../../hooks/useVisualViewport'
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
  const { keyboardInset } = useVisualViewport()

  const lastStatus = messages.at(-1)?.role === 'assistant' ? (messages.at(-1) as { status: string }).status : ''
  useEffect(() => {
    if (!messages.length) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' })
  }, [messages.length, lastStatus, keyboardInset])

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
          <div className="flex flex-col items-center px-2 pt-6 pb-2 text-center md:pt-10">
            <span className="flex size-16 items-center justify-center rounded-full bg-tone-blue-bg text-tone-blue shadow-sm ring-8 ring-tone-blue-bg/50">
              <Bot aria-hidden className="size-8" />
            </span>
            <p className="mt-4 text-lg font-bold">{t('chat.welcome.title')}</p>
            <p className="mt-1 text-muted">{t('chat.welcome.body')}</p>
            {/* 추천 질문은 대화 시작 전에만 (부모가 빈 목록을 넘김) */}
            {suggestions.length > 0 && (
              <ul aria-label={t('chat.suggestions.label')} className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <li key={s} className="min-w-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => submit(s)}
                      className="card flex min-h-12 w-full items-center px-4 py-2.5 text-left text-sm transition-colors hover:border-accent/50 hover:bg-tone-blue-bg/40 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} ctx={ctx} />
        ))}
        <div ref={endRef} />
      </div>

      {/* 가상 키보드가 열리면(visualViewport) 입력창을 키보드 바로 위로 올린다 — 탭바는 키보드에 가려짐 (V-06) */}
      <div
        data-testid="chat-composer"
        data-keyboard-inset={keyboardInset}
        style={keyboardInset ? { bottom: keyboardInset } : undefined}
        className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 space-y-2 border-t border-border bg-bg/95 px-4 pt-3 pb-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-t-xl lg:border-x lg:px-4">
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
            className="min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-3 shadow-[var(--shadow-card)] focus-visible:outline-2 focus-visible:outline-accent"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label={t('chat.input.send')}
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <SendHorizontal aria-hidden className="size-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
