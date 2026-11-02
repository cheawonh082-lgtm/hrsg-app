import { Calculator, FlaskConical, RotateCcw, X } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useGtModels, useInputLimits } from '../api/hooks/useCalc'
import { useChat } from '../api/hooks/useChat'
import { useHealth } from '../api/hooks/useHealth'
import { ChatWindow } from '../components/chat/ChatWindow'
import { useChatStore } from '../store/chat'

export function ChatPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const health = useHealth()
  const models = useGtModels()
  const limits = useInputLimits()
  const { messages, calcContextId, setCalcContextId, reset } = useChatStore()
  const { ask, resend, retry } = useChat()

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

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('pages.chatTitle')}</h1>
          <p className="text-muted">{t('chat.subtitle')}</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <RotateCcw aria-hidden className="size-4" />
            {t('chat.newChat')}
          </button>
        )}
      </header>

      {devModeKey && (
        <p data-testid="chat-dev-mode" className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-sm text-muted">
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
  )
}
