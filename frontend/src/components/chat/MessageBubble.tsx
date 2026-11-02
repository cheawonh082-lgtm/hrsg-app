import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PartialCalcInput } from '../../api/hooks/useChat'
import type {
  AnswerBlock,
  CalcResultCard as CalcResultCardData,
  ChatRequest,
  GasTurbineSpec,
  InputLimits,
  ParamConfirmCard as ParamConfirmData,
} from '../../api/types'
import type { ChatMessage } from '../../store/chat'
import { CalcResultCard } from './CalcResultCard'
import { CitationList } from './CitationList'
import { FIELD_DEFS } from './fieldMeta'
import { NoticeBlock } from './NoticeBlock'
import { ParamConfirmCard } from './ParamConfirmCard'
import { ProcessIndicator } from './ProcessIndicator'

export interface MessageContext {
  models: GasTurbineSpec[]
  limits: InputLimits | undefined
  mockDocs: boolean
  onResend: (request: ChatRequest, input: PartialCalcInput) => void
  onRetry: (request: ChatRequest) => void
}

export function MessageBubble({ message, ctx }: { message: ChatMessage; ctx: MessageContext }) {
  const { t } = useTranslation()

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p
          data-testid="user-message"
          className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-4 py-2 break-words whitespace-pre-wrap text-accent-fg"
        >
          {message.text}
        </p>
      </div>
    )
  }

  return (
    <article
      data-testid="assistant-message"
      data-status={message.status}
      aria-busy={message.status === 'pending'}
      className="min-w-0 space-y-3"
    >
      <ProcessIndicator trace={message.response?.trace} pending={message.status === 'pending'} />

      {message.status === 'error' && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger">
          <span className="min-w-0 flex-1">{t(`chat.errors.${message.errorCode}`, { defaultValue: t('chat.error', { code: message.errorCode }) })}</span>
          <button
            type="button"
            onClick={() => ctx.onRetry(message.request)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-current px-3 font-medium focus-visible:outline-2 focus-visible:outline-accent"
          >
            <RotateCcw aria-hidden className="size-4" />
            {t('chat.retry')}
          </button>
        </div>
      )}

      {message.response?.blocks.map((block, i) => (
        <Block key={i} block={block} request={message.request} ctx={ctx} />
      ))}
    </article>
  )
}

function Block({ block, request, ctx }: { block: AnswerBlock; request: ChatRequest; ctx: MessageContext }) {
  switch (block.type) {
    case 'text':
      return (
        <div data-testid="answer-text" className="space-y-2 leading-relaxed">
          {block.markdown.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="break-words whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      )
    case 'calc_result':
      return <ResultCardWithEdit card={block} request={request} ctx={ctx} />
    case 'param_confirm':
      return (
        <ParamConfirmCard
          card={block}
          models={ctx.models}
          limits={ctx.limits}
          onSubmit={(input) => ctx.onResend(request, input)}
        />
      )
    case 'citations':
      return <CitationList items={block.items} mockDocs={ctx.mockDocs} style={block.style} />
    case 'notice':
      return <NoticeBlock notice={block} />
  }
}

/** 결과 카드 + "가정 수정" (확인 카드를 사용자 입력값으로 다시 연다) */
function ResultCardWithEdit({ card, request, ctx }: { card: CalcResultCardData; request: ChatRequest; ctx: MessageContext }) {
  const [editing, setEditing] = useState(false)

  if (!editing) return <CalcResultCard card={card} models={ctx.models} onEdit={() => setEditing(true)} />
  return (
    <ParamConfirmCard
      card={toEditCard(card)}
      models={ctx.models}
      limits={ctx.limits}
      variant="edit"
      onCancel={() => setEditing(false)}
      onSubmit={(input) => {
        setEditing(false)
        ctx.onResend(request, input)
      }}
    />
  )
}

const REQUIRED = ['gtModelId', 'hrsgGasDpMbar', 'stackTempC']

function toEditCard(card: CalcResultCardData): ParamConfirmData {
  const extracted: PartialCalcInput & { condition: Record<string, unknown>; economics: Record<string, unknown> } = {
    condition: {},
    economics: {},
  }
  for (const a of card.assumptions) {
    if (a.key === 'gtModelId') extracted.gtModelId = String(a.value)
    else if ((a.source === 'user' || REQUIRED.includes(a.key)) && FIELD_DEFS[a.key]) {
      extracted[FIELD_DEFS[a.key].group][a.key] = a.value
    }
  }
  return { type: 'param_confirm', extracted, missing: [], defaultsProposed: {} }
}
