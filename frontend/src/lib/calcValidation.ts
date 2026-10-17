import { z } from 'zod'

import type { CalcInput, FieldLimit, InputLimits } from '../api/types'
import type { Locale } from '../store/ui'
import type { CalcDraft } from './calcDraft'

export type FieldErrorCode = 'required' | 'invalid' | 'integer' | 'min' | 'max'

export interface FieldError {
  code: FieldErrorCode
  limit?: number | null
  exclusive?: boolean
}

/** 키: 'condition.hrsgGasDpMbar' 형식 */
export type FieldErrors = Partial<Record<string, FieldError>>

const CODES: FieldErrorCode[] = ['required', 'invalid', 'integer', 'min', 'max']

function fieldSchema(limit: FieldLimit) {
  // 빈 칸(null/undefined)은 'required', NaN 등 숫자가 아닌 값은 'invalid'
  let s = z.number({ error: (issue) => (issue.input == null ? 'required' : 'invalid') })
  if (limit.integer) s = s.int({ error: 'integer' })
  if (limit.min != null) s = limit.exclusiveMin ? s.gt(limit.min, { error: 'min' }) : s.gte(limit.min, { error: 'min' })
  if (limit.max != null) s = limit.exclusiveMax ? s.lt(limit.max, { error: 'max' }) : s.lte(limit.max, { error: 'max' })
  return limit.nullable ? s.nullish() : s
}

function shape(group: Record<string, FieldLimit>) {
  return Object.fromEntries(Object.entries(group).map(([key, limit]) => [key, fieldSchema(limit)]))
}

/** 백엔드 입력 범위(/api/calc/input-limits)로 zod 스키마를 만든다 — 범위를 프론트에 하드코딩하지 않음 */
export function buildCalcSchema(limits: InputLimits) {
  return z.object({
    gtModelId: z.string().min(1),
    condition: z.object(shape(limits.condition)),
    economics: z.object(shape(limits.economics)),
  })
}

export type CalcSchema = ReturnType<typeof buildCalcSchema>

export function validateDraft(
  draft: CalcDraft,
  schema: CalcSchema,
  limits: InputLimits,
  locale: Locale,
): { input?: CalcInput; errors: FieldErrors } {
  const parsed = schema.safeParse(draft)
  if (parsed.success) return { input: { ...parsed.data, locale } as CalcInput, errors: {} }

  const errors: FieldErrors = {}
  for (const issue of parsed.error.issues) {
    const [group, key] = issue.path as ['condition' | 'economics', string]
    const limit = limits[group]?.[key]
    const code = CODES.includes(issue.message as FieldErrorCode) ? (issue.message as FieldErrorCode) : 'invalid'
    errors[`${group}.${key}`] ??= {
      code,
      limit: code === 'min' ? limit?.min : code === 'max' ? limit?.max : undefined,
      exclusive: code === 'min' ? limit?.exclusiveMin : code === 'max' ? limit?.exclusiveMax : undefined,
    }
  }
  return { errors }
}

/** 필드 하나 검증 (챗 확인 카드 등 계산기 밖 입력용). 빈 칸은 nullable이어도 'required'. */
export function validateField(limit: FieldLimit | undefined, value: number | null | undefined): FieldError | undefined {
  if (value == null) return { code: 'required' }
  if (!limit) return Number.isFinite(value) ? undefined : { code: 'invalid' }
  const parsed = fieldSchema(limit).safeParse(value)
  if (parsed.success) return undefined
  const message = parsed.error.issues[0]?.message
  const code = CODES.includes(message as FieldErrorCode) ? (message as FieldErrorCode) : 'invalid'
  return {
    code,
    limit: code === 'min' ? limit.min : code === 'max' ? limit.max : undefined,
    exclusive: code === 'min' ? limit.exclusiveMin : code === 'max' ? limit.exclusiveMax : undefined,
  }
}
