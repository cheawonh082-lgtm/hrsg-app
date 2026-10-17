import { RotateCcw, TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import type { GasTurbineSpec, InputLimits } from '../../api/types'
import { type CalcDraft, setDraftField } from '../../lib/calcDraft'
import type { FieldErrors } from '../../lib/calcValidation'
import { cn } from '../../lib/cn'
import { Accordion } from '../common/Accordion'
import { FIELD_GROUPS, type FieldDef, type FieldGroupId } from './inputFields'
import { NumberField } from './NumberField'

export interface InputPanelProps {
  draft: CalcDraft
  limits: InputLimits
  errors: FieldErrors
  models: GasTurbineSpec[]
  isBlocked: boolean
  onDraftChange: (draft: CalcDraft) => void
  onModelChange: (gtModelId: string) => void
  onReset: () => void
  /** sidebar: PC 좌측 패널 / inline: 태블릿 상단(2열) / sheet: 모바일 바텀시트 */
  variant?: 'sidebar' | 'inline' | 'sheet'
}

export function InputPanel({
  draft,
  limits,
  errors,
  models,
  isBlocked,
  onDraftChange,
  onModelChange,
  onReset,
  variant = 'sidebar',
}: InputPanelProps) {
  const { t } = useTranslation()
  const modelId = useId()

  const unitLabel = (unit: string) => (unit.startsWith('@') ? t(`calc.units.${unit.slice(1)}`) : unit)
  const errorCount = (groupId: FieldGroupId) =>
    FIELD_GROUPS.find((g) => g.id === groupId)!.fields.filter((f) => errors[`${f.group}.${f.key}`]).length

  const renderFields = (fields: FieldDef[]) => (
    <div className={cn('grid gap-4', variant === 'inline' && 'md:grid-cols-2 md:gap-x-6')}>
      {fields.map((f) => (
        <NumberField
          key={f.key}
          label={t(`calc.fields.${f.key}`)}
          unit={unitLabel(f.unit)}
          value={draft[f.group][f.key as keyof CalcDraft[typeof f.group]]}
          onChange={(v) => onDraftChange(setDraftField(draft, f.group, f.key, v))}
          slider={f.slider}
          error={errors[`${f.group}.${f.key}`]}
          nullable={limits[f.group][f.key]?.nullable}
        />
      ))}
    </div>
  )

  const groupBadge = (groupId: FieldGroupId) => {
    const count = errorCount(groupId)
    return count > 0 ? (
      <span className="rounded-full bg-status-danger/10 px-2 py-0.5 text-xs font-semibold text-status-danger">
        {t('calc.input.errorCount', { count })}
      </span>
    ) : null
  }

  const [primary, operation, advanced, economics] = FIELD_GROUPS

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={modelId} className="text-sm font-medium">
            {t('calc.input.model')}
          </label>
          <select
            id={modelId}
            value={draft.gtModelId}
            onChange={(e) => onModelChange(e.target.value)}
            className="h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {models.map((m) => (
              <option key={m.modelId} value={m.modelId}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onReset}
          aria-label={t('calc.input.reset')}
          title={t('calc.input.reset')}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
        >
          <RotateCcw aria-hidden className="size-4" />
        </button>
      </div>

      {isBlocked && (
        <p
          role="alert"
          className="flex gap-2 rounded-lg border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{t('calc.input.blocked')}</span>
        </p>
      )}

      <section aria-labelledby={`${modelId}-primary`} className="space-y-3">
        <h3 id={`${modelId}-primary`} className="font-medium">
          {t('calc.input.primary')}
        </h3>
        {renderFields(primary.fields)}
      </section>

      <div>
        <Accordion title={t('calc.input.operation')} defaultOpen={variant !== 'sheet'} badge={groupBadge('operation')}>
          {renderFields(operation.fields)}
        </Accordion>
        <Accordion title={t('calc.input.advanced')} badge={groupBadge('advanced')}>
          <p className="mb-3 text-sm text-muted">{t('calc.input.advancedHint')}</p>
          {renderFields(advanced.fields)}
        </Accordion>
        <Accordion title={t('calc.input.economics')} badge={groupBadge('economics')}>
          {renderFields(economics.fields)}
        </Accordion>
      </div>
    </div>
  )
}
