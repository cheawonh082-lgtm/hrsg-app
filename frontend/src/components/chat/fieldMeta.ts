import type { TFunction } from 'i18next'

import type { GasTurbineSpec } from '../../api/types'
import { formatNumber } from '../../lib/format'
import type { Locale } from '../../store/ui'
import { FIELD_GROUPS, type FieldDef } from '../calculator/inputFields'

/** 계산 입력 필드 정의(그룹·단위·슬라이더) — 계산기 InputPanel과 같은 정의를 쓴다 */
export const FIELD_DEFS: Record<string, FieldDef> = Object.fromEntries(
  FIELD_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f]),
)

export function fieldLabel(t: TFunction, key: string) {
  return key === 'gtModelId' ? t('calc.input.model') : t(`calc.fields.${key}`, { defaultValue: key })
}

export function unitLabel(t: TFunction, unit: string | null | undefined) {
  if (!unit) return ''
  return unit.startsWith('@') ? t(`calc.units.${unit.slice(1)}`) : unit
}

export function modelName(models: GasTurbineSpec[] | undefined, id: string) {
  return models?.find((m) => m.modelId === id)?.displayName ?? id
}

/** 가정값 표시: 모델은 이름, 숫자는 로케일 포맷 + 단위 */
export function formatAssumption(
  value: number | string,
  unit: string | null | undefined,
  locale: Locale,
  models: GasTurbineSpec[] | undefined,
) {
  if (typeof value === 'string') return modelName(models, value)
  const n = formatNumber(value, locale, { maximumFractionDigits: 2 })
  return unit ? `${n} ${unit}` : n
}
