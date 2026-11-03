import { CornerDownRight, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PartialCalcInput } from '../../api/hooks/useChat'
import type {
  AnswerBlock,
  CalcResultCard as CalcResultCardData,
  ChatRequest,
  CitationsBlock,
  GasTurbineSpec,
  InputLimits,
  ParamConfirmCard as ParamConfirmData,
} from '../../api/types'
import type { ChatMessage } from '../../store/chat'
import { CalcResultCard } from './CalcResultCard'
import { CitationChip, CitationList } from './CitationList'
import { FIELD_DEFS } from './fieldMeta'
import { Markdown } from './Markdown'
import { NoticeBlock } from './NoticeBlock'
import { ParamConfirmCard } from './ParamConfirmCard'
import { ProcessIndicator } from './ProcessIndicator'

export interface MessageContext {
  models: GasTurbineSpec[]
  limits: InputLimits | undefined
  mockDocs: boolean
  onResend: (request: ChatRequest, input: PartialCalcInput) => void
  onRetry: (request: ChatRequest) => void
  onAsk: (text: string) => void // 후속 질문 버튼
  busy: boolean
  showFollowUps: boolean // 후속 질문은 마지막 답변에만
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
        <Block
          key={i}
          block={block}
          request={message.request}
          ctx={ctx}
          citations={message.response?.blocks.find((b): b is CitationsBlock => b.type === 'citations')}
        />
      ))}
    </article>
  )
}

function Block({
  block,
  request,
  ctx,
  citations,
}: {
  block: AnswerBlock
  request: ChatRequest
  ctx: MessageContext
  citations?: CitationsBlock
}) {
  switch (block.type) {
    case 'text':
      // [n]은 같은 응답 citations.items의 n번째 — 출처가 없으면 번호 표시는 그리지 않는다
      return (
        <div data-testid="answer-text">
          <Markdown
            text={block.markdown}
            renderCite={(nums, key) =>
              citations ? <CitationChip key={key} items={citations.items} nums={nums} style={citations.style ?? 'excerpts'} /> : null
            }
          />
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
    case 'follow_ups':
      return ctx.showFollowUps ? <FollowUps items={block.items} ctx={ctx} /> : null
  }
}

/** 답변 끝 후속 질문 버튼 — 누르면 그 문장을 새 질문으로 보낸다 */
function FollowUps({ items, ctx }: { items: string[]; ctx: MessageContext }) {
  const { t } = useTranslation()
  return (
    <section aria-label={t('chat.followUps')} data-testid="follow-ups" className="space-y-1.5 border-t border-border pt-3">
      <h3 className="text-xs font-medium text-muted">{t('chat.followUps')}</h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((q) => (
          <li key={q} className="min-w-0">
            <button
              type="button"
              disabled={ctx.busy}
              onClick={() => ctx.onAsk(q)}
              className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-left text-sm hover:border-accent/50 hover:bg-tone-blue-bg/40 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
            >
              <CornerDownRight aria-hidden className="size-3.5 shrink-0 text-muted" />
              <span className="min-w-0">{q}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
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
