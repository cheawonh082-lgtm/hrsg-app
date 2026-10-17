import type { CalcInput, ConditionKey, EconomicsKey } from '../api/types'

/**
 * 화면에서 편집 중인 입력값. 입력 도중의 빈 칸(null)이나 잘못된 값(NaN)도 담을 수 있다.
 * 검증(calcValidation)을 통과한 경우에만 CalcInput으로 바뀌어 API로 전송된다.
 */
export interface CalcDraft {
  gtModelId: string
  condition: Partial<Record<ConditionKey, number | null>>
  economics: Partial<Record<EconomicsKey, number | null>>
}

export type DraftGroup = 'condition' | 'economics'

export function toDraft(input: CalcInput): CalcDraft {
  return { gtModelId: input.gtModelId, condition: { ...input.condition }, economics: { ...input.economics } }
}

export function setDraftField(draft: CalcDraft, group: DraftGroup, key: string, value: number | null): CalcDraft {
  return { ...draft, [group]: { ...draft[group], [key]: value } }
}
