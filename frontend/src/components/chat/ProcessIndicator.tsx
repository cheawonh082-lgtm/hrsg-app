import { Check, ChevronDown, LoaderCircle, Minus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ProcessStep } from '../../api/types'
import { cn } from '../../lib/cn'

const ORDER: ProcessStep['step'][] = [
  'detect_language',
  'classify_intent',
  'extract_params',
  'calculate',
  'retrieve',
  'compose',
  'validate',
]

const ICON = { done: Check, skipped: Minus, error: X, running: LoaderCircle } as const

/**
 * 처리 과정 칩 (PRD §3.2). 건너뛴 단계는 숨긴다.
 * 모바일은 요약 한 줄(탭하면 전체), sm 이상은 칩 전체 표시 (PRD §3.4.2).
 */
export function ProcessIndicator({ trace, pending }: { trace?: ProcessStep[]; pending?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  if (pending) {
    return (
      <p role="status" className="inline-flex items-center gap-2 text-sm text-muted">
        <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
        {t('chat.steps.working')}
      </p>
    )
  }

  const steps = [...(trace ?? [])]
    .filter((s) => s.status !== 'skipped')
    .sort((a, b) => ORDER.indexOf(a.step) - ORDER.indexOf(b.step))
  if (!steps.length) return null

  const chips = (
    <ol className="flex flex-wrap gap-1.5" aria-label={t('chat.steps.label')}>
      {steps.map((s) => {
        const Icon = ICON[s.status]
        return (
          <li
            key={s.step}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
              s.status === 'error' ? 'border-status-danger/40 text-status-danger' : 'border-border text-muted',
            )}
          >
            <Icon aria-hidden className="size-3" />
            {t(`chat.steps.${s.step}`)}
          </li>
        )
      })}
    </ol>
  )

  return (
    <div data-testid="process-indicator">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted sm:hidden"
      >
        <Check aria-hidden className="size-4" />
        {t('chat.steps.summary', { count: steps.length })}
        <ChevronDown aria-hidden className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      <div className={cn('sm:block', open ? 'block' : 'hidden')}>{chips}</div>
    </div>
  )
}
