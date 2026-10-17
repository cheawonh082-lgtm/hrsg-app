import { Calculator } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PartialCalcInput } from '../../api/hooks/useChat'
import type { GasTurbineSpec, InputLimits, ParamConfirmCard as ParamConfirmData } from '../../api/types'
import { validateField } from '../../lib/calcValidation'
import { NumberField } from '../calculator/NumberField'
import { FIELD_DEFS, unitLabel } from './fieldMeta'

interface Props {
  card: ParamConfirmData
  models: GasTurbineSpec[]
  limits: InputLimits | undefined
  onSubmit: (input: PartialCalcInput) => void
  /** 결과 카드의 "가정 수정"에서 열었을 때 */
  variant?: 'confirm' | 'edit'
  onCancel?: () => void
}

type Values = Record<string, number | null>

/**
 * 계산 파라미터 확인 (PRD §3.2, G-4). 질문에서 뽑은 값 + 빠진 필수값(기본값 제안)을 보여 주고,
 * 사용자가 확인하면 같은 질문을 calcContext.input에 담아 다시 보낸다 → 서버가 계산해 결과 카드로 교체.
 */
export function ParamConfirmCard({ card, models, limits, onSubmit, variant = 'confirm', onCancel }: Props) {
  const { t } = useTranslation()
  const modelSelectId = useId()
  const extracted = card.extracted as PartialCalcInput
  const proposed = card.defaultsProposed

  const fieldKeys = useMemo(() => {
    const keys = [
      ...card.missing,
      ...Object.keys(extracted.condition ?? {}),
      ...Object.keys(extracted.economics ?? {}),
    ].filter((k) => k !== 'gtModelId' && FIELD_DEFS[k])
    return [...new Set(keys)]
  }, [card.missing, extracted])

  const [modelId, setModelId] = useState<string>(
    extracted.gtModelId ?? (proposed.gtModelId as string | undefined) ?? models[0]?.modelId ?? '',
  )
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(
      fieldKeys.map((k) => {
        const def = FIELD_DEFS[k]
        const given = (extracted[def.group] as Record<string, number | null> | undefined)?.[k]
        return [k, given ?? (proposed[k] as number | undefined) ?? null]
      }),
    ),
  )
  const [touched, setTouched] = useState(false)

  const errors = Object.fromEntries(
    fieldKeys.map((k) => [k, validateField(limits?.[FIELD_DEFS[k].group]?.[k], values[k])]),
  )
  const hasError = !modelId || Object.values(errors).some(Boolean)

  const submit = () => {
    setTouched(true)
    if (hasError) return
    const input: PartialCalcInput = { gtModelId: modelId, condition: { ...extracted.condition }, economics: { ...extracted.economics } }
    for (const k of fieldKeys) {
      const group = FIELD_DEFS[k].group
      ;(input[group] as Record<string, number | null>)[k] = values[k]
    }
    onSubmit(input)
  }

  return (
    <section
      data-testid="param-confirm-card"
      aria-label={t(variant === 'edit' ? 'chat.confirm.editTitle' : 'chat.confirm.title')}
      className="space-y-4 rounded-xl border border-accent/40 bg-surface p-4"
    >
      <header className="space-y-1">
        <h3 className="font-semibold">{t(variant === 'edit' ? 'chat.confirm.editTitle' : 'chat.confirm.title')}</h3>
        <p className="text-sm text-muted">{t(variant === 'edit' ? 'chat.confirm.editHint' : 'chat.confirm.hint')}</p>
      </header>

      <div className="min-w-0">
        <label htmlFor={modelSelectId} className="mb-1 block text-sm font-medium">
          {t('calc.input.model')}
          {card.missing.includes('gtModelId') && <MissingBadge />}
        </label>
        <select
          id={modelSelectId}
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {models.map((m) => (
            <option key={m.modelId} value={m.modelId}>
              {m.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-6">
        {fieldKeys.map((k) => (
          <div key={k} className="min-w-0">
            <NumberField
              label={t(`calc.fields.${k}`) + (card.missing.includes(k) ? ` · ${t('chat.confirm.proposed')}` : '')}
              unit={unitLabel(t, FIELD_DEFS[k].unit)}
              value={values[k]}
              onChange={(v) => setValues((prev) => ({ ...prev, [k]: v }))}
              slider={FIELD_DEFS[k].slider}
              error={touched || values[k] != null ? errors[k] : undefined}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg border border-border px-4 font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {t('chat.confirm.cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Calculator aria-hidden className="size-4" />
          {t('chat.confirm.run')}
        </button>
      </div>
    </section>
  )
}

function MissingBadge() {
  const { t } = useTranslation()
  return (
    <span className="ml-2 rounded-full bg-status-caution/15 px-2 py-0.5 text-xs font-semibold text-status-caution">
      {t('chat.confirm.missing')}
    </span>
  )
}
