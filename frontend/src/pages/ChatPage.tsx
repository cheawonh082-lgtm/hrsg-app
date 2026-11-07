import { Calculator, FlaskConical, History, PanelLeftClose, PanelLeftOpen, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useGtModels, useInputLimits } from '../api/hooks/useCalc'
import { useChat } from '../api/hooks/useChat'
import { useHealth } from '../api/hooks/useHealth'
import { ChatHistory } from '../components/chat/ChatHistory'
import { ChatWindow } from '../components/chat/ChatWindow'
import { Drawer } from '../components/layout/Drawer'
import { useChatStore } from '../store/chat'
import { useUiStore } from '../store/ui'

export function ChatPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const health = useHealth()
  const models = useGtModels()
  const limits = useInputLimits()
  const { messages, calcContextId, setCalcContextId, reset } = useChatStore()
  const { ask, resend, retry } = useChat()
  const collapsed = useUiStore((s) => s.chatHistoryCollapsed)
  const setCollapsed = useUiStore((s) => s.setChatHistoryCollapsed)
  const [historyOpen, setHistoryOpen] = useState(false)

  // 계산기 "AI에게 질문하기"에서 넘어온 calcId(state 또는 ?calcId=) → 대화 맥락으로 보관하고 주소·state는 비운다
  const [searchParams] = useSearchParams()
  const incomingCalcId = (location.state as { calcId?: string } | null)?.calcId ?? searchParams.get('calcId')
  useEffect(() => {
    if (!incomingCalcId) return
    setCalcContextId(incomingCalcId)
    navigate('/chat', { replace: true, state: null })
  }, [incomingCalcId, setCalcContextId, navigate])

  // 개발 모드 안내: Fake LLM이면 답변·문서 모두, 실제 LLM이면 예시 문서 사용 여부만
  const devModeKey = !health.data
    ? null
    : health.data.llm === 'fake'
      ? 'chat.devMode'
      : health.data.docs === 'mock'
        ? 'chat.devModeDocs'
        : null
  // 추천 질문은 대화 시작 전에만 — 모바일에서 대화 영역을 가리지 않도록
  const suggestions =
    messages.length > 0
      ? []
      : calcContextId
        ? [t('chat.suggestions.interpret'), t('chat.suggestions.cleaning')]
        : [t('chat.suggestions.s1'), t('chat.suggestions.s2'), t('chat.suggestions.s3'), t('chat.suggestions.s4')]

  const headerBtn =
    'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent'

  return (
    <div className="mx-auto flex w-full max-w-6xl items-start gap-6">
      {/* PC: 좌측 대화 기록 사이드바(접기 가능). 모바일·태블릿은 헤더 버튼 → 드로어 (PRD §3.4.4) */}
      {!collapsed && (
        <aside
          data-testid="chat-history-sidebar"
          aria-label={t('chat.history.title')}
          className="card sticky top-[calc(var(--app-header-h,4rem)+1.5rem)] hidden h-[calc(100dvh-var(--app-header-h,4rem)-3.5rem)] w-64 shrink-0 flex-col gap-3 p-3 lg:flex"
        >
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 px-1 text-sm font-semibold">{t('chat.history.title')}</h2>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label={t('chat.history.collapse')}
              title={t('chat.history.collapse')}
              className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
            >
              <PanelLeftClose aria-hidden className="size-4" />
            </button>
          </div>
          <ChatHistory />
        </aside>
      )}

      <section className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-3xl min-w-0 flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-start gap-3">
          {/* PC에서 사이드바를 접었을 때만 — 사이드바가 있던 좌측 상단에서 다시 펼친다 */}
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              data-testid="chat-history-expand"
              aria-label={t('chat.history.expand')}
              title={t('chat.history.expand')}
              className="hidden size-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent lg:flex"
            >
              <PanelLeftOpen aria-hidden className="size-5" />
            </button>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{t('pages.chatTitle')}</h1>
            <p className="text-muted">{t('chat.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            data-testid="chat-history-open"
            className={`${headerBtn} lg:hidden`}
          >
            <History aria-hidden className="size-4" />
            {t('chat.history.title')}
          </button>
          {messages.length > 0 && (
            <button type="button" onClick={reset} className={headerBtn}>
              <RotateCcw aria-hidden className="size-4" />
              {t('chat.newChat')}
            </button>
          )}
        </header>

        {devModeKey && (
          <p
            data-testid="chat-dev-mode"
            className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-sm text-muted"
          >
            <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{t(devModeKey)}</span>
          </p>
        )}

        {calcContextId && (
          <p
            data-testid="chat-calc-context"
            className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm"
          >
            <Calculator aria-hidden className="size-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">{t('chat.calcContext')}</span>
            <button
              type="button"
              onClick={() => setCalcContextId(null)}
              aria-label={t('chat.calcContextClear')}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X aria-hidden className="size-4" />
            </button>
          </p>
        )}

        <ChatWindow
          messages={messages}
          suggestions={suggestions}
          onAsk={(text) => void ask(text)}
          ctx={{
            models: models.data ?? [],
            limits: limits.data,
            mockDocs: health.data?.docs === 'mock',
            onResend: (request, input) => void resend(request, input),
            onRetry: (request) => void retry(request),
          }}
        />
      </section>

      <Drawer open={historyOpen} onClose={() => setHistoryOpen(false)} title={t('chat.history.title')}>
        <ChatHistory onDone={() => setHistoryOpen(false)} />
      </Drawer>
    </div>
  )
}
