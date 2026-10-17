import { ExternalLink, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { Assumption, CalcResultCard as CalcResultCardData, GasTurbineSpec } from '../../api/types'
import { formatKrwCompact, formatKrwFull, formatNumber } from '../../lib/format'
import { useUiStore } from '../../store/ui'
import { StatusPill } from '../common/StatusPill'
import { cleaningMethodKey, fieldLabel, formatAssumption } from './fieldMeta'

const HEADLINE_LABEL: Record<string, string> = {
  totalPowerLossMw: 'calc.kpi.totalLoss',
  annualRevenueLossKrw: 'calc.kpi.annualLoss',
  annualRecoveryKrw: 'calc.kpi.annualRecovery',
  foulingIndex: 'chat.card.foulingIndex',
}

interface Props {
  card: CalcResultCardData
  models: GasTurbineSpec[] | undefined
  onEdit?: () => void
}

/** 계산 결과 카드 (PRD §3.2). 모든 숫자는 서버가 CalcResult에서 직접 매핑한 값 — LLM 서술과 무관 (G-5) */
export function CalcResultCard({ card, models, onEdit }: Props) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const navigate = useNavigate()

  const userItems = card.assumptions.filter((a) => a.source === 'user')
  const defaultItems = card.assumptions.filter((a) => a.source === 'default')

  const display = (key: string, value: number, unit: string) => {
    if (unit === 'KRW') return { text: formatKrwCompact(value, locale), title: formatKrwFull(value, locale) }
    if (unit === 'MW') return { text: `${formatNumber(value, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MW` }
    if (key === 'foulingIndex') return { text: `${formatNumber(value, locale, { maximumFractionDigits: 0 })} / 100` }
    return { text: `${formatNumber(value, locale, { maximumFractionDigits: 2 })} ${unit}` }
  }

  return (
    <section
      data-testid="calc-result-card"
      aria-label={t('chat.card.title')}
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-semibold">{t('chat.card.title')}</h3>
        {card.isMock && (
          <span className="rounded-md bg-mock-bg px-2 py-0.5 text-xs font-bold text-mock-fg">MOCK</span>
        )}
        <StatusPill status={card.status} size="sm" />
      </header>

      <dl className="grid grid-cols-2 gap-3">
        {card.headline.map((m) => {
          const { text, title } = display(m.key, m.value, m.unit)
          return (
            <div key={m.key} className="min-w-0 rounded-lg bg-surface-2 p-3">
              <dt className="truncate text-xs text-muted">{t(HEADLINE_LABEL[m.key] ?? m.key)}</dt>
              <dd
                data-testid={`card-${m.key}`}
                title={title}
                className="mt-1 truncate text-lg font-bold tabular-nums sm:text-xl"
              >
                {text}
              </dd>
            </div>
          )
        })}
      </dl>

      {card.recommendedMethodId && (
        <p className="text-sm">
          <span className="text-muted">{t('chat.card.recommended')}: </span>
          <span className="font-semibold">{t(cleaningMethodKey(card.recommendedMethodId))}</span>
        </p>
      )}

      <div className="space-y-2 text-sm">
        <h4 className="font-medium">{t('chat.card.assumptions')}</h4>
        <AssumptionList items={userItems} models={models} source="user" />
        {defaultItems.length > 0 && (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer items-center text-muted hover:text-text">
              {t('chat.card.defaults', { count: defaultItems.length })}
            </summary>
            <AssumptionList items={defaultItems} models={models} source="default" />
          </details>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate(`/calculator?calcId=${encodeURIComponent(card.calcId)}`)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ExternalLink aria-hidden className="size-4" />
          {t('chat.card.openInCalculator')}
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Pencil aria-hidden className="size-4" />
            {t('chat.card.edit')}
          </button>
        )}
      </div>
    </section>
  )
}

function AssumptionList({
  items,
  models,
  source,
}: {
  items: Assumption[]
  models: GasTurbineSpec[] | undefined
  source: Assumption['source']
}) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  return (
    <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2" data-testid={`assumptions-${source}`}>
      {items.map((a) => (
        <li key={a.key} className="flex min-w-0 justify-between gap-2 border-b border-border/60 py-1">
          <span className="min-w-0 truncate text-muted">{fieldLabel(t, a.key)}</span>
          <span className="shrink-0 font-medium tabular-nums">
            {formatAssumption(a.value, a.unit, locale, models)}
            {source === 'user' && <span className="sr-only"> ({t('chat.card.userValue')})</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
