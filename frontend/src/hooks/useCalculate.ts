import { useEffect, useMemo, useState } from 'react'

import { useEvaluate } from '../api/hooks/useCalc'
import type { CalcInput, InputLimits } from '../api/types'
import type { CalcDraft } from '../lib/calcDraft'
import { buildCalcSchema, validateDraft } from '../lib/calcValidation'
import { useUiStore } from '../store/ui'

export const CALC_DEBOUNCE_MS = 300

/**
 * 편집 중 입력값 → 검증 → 디바운스 → POST /api/calc/evaluate.
 * - 검증 실패 시 요청하지 않고(계산 차단) 마지막 정상 결과를 유지한다.
 * - 첫 입력은 즉시, 이후 변경은 마지막 변경 후 delay(ms)가 지나면 한 번만 요청한다.
 */
export function useCalculate(draft: CalcDraft | null, limits: InputLimits | undefined, delay = CALC_DEBOUNCE_MS) {
  const locale = useUiStore((s) => s.locale)
  const schema = useMemo(() => (limits ? buildCalcSchema(limits) : undefined), [limits])
  const validation = useMemo(
    () => (draft && schema && limits ? validateDraft(draft, schema, limits, locale) : undefined),
    [draft, schema, limits, locale],
  )
  const valid = validation?.input

  const [committed, setCommitted] = useState<CalcInput>()
  const isFirst = committed === undefined

  useEffect(() => {
    if (!valid) return
    if (isFirst) {
      setCommitted(valid)
      return
    }
    const timer = window.setTimeout(() => setCommitted(valid), delay)
    return () => window.clearTimeout(timer)
  }, [valid, isFirst, delay])

  const query = useEvaluate(committed)

  return {
    result: query.data,
    error: query.error,
    errors: validation?.errors ?? {},
    isBlocked: !!validation && !valid,
    /** 디바운스 대기 중이거나 요청 중 */
    isPending: (!!valid && valid !== committed) || query.isFetching,
  }
}
