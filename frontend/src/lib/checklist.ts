import type {
  ChecklistCategory,
  ChecklistItem,
  ChecklistItemPatch,
  ChecklistItemState,
  ChecklistProgress,
  ItemStatus,
} from '../api/types'

export type ChecklistFilter = 'all' | 'required' | 'unchecked'
type PatchStatus = NonNullable<ChecklistItemPatch['status']>

/** 키트 is_received: 수령 완료 + 검증 필요 */
const isReceived = (status: ItemStatus | undefined) => status === 'received' || status === 'verify_needed'

/**
 * 진행률 — 서버가 쓰는 키트 summary()와 같은 규칙. 낙관적 업데이트 때 서버 응답을 기다리지 않고 바로 다시 계산하는 데 쓴다.
 * 해당 없음(na)은 분모에서 빼고, 비율은 소수 첫째 자리에서 반올림한다(「2% (1/49)」).
 */
export function computeProgress(
  items: ChecklistItem[],
  states: ChecklistItemState[],
  categories: ChecklistCategory[],
): ChecklistProgress {
  const byId = new Map(states.map((s) => [s.itemId, s]))
  const byCategory: ChecklistProgress['byCategory'] = Object.fromEntries(categories.map((c) => [c, { total: 0, checked: 0 }]))
  let total = 0
  let checked = 0
  let requiredTotal = 0
  let requiredChecked = 0
  for (const item of items) {
    const status = byId.get(item.id)?.status
    if (status === 'na') continue
    const done = isReceived(status) ? 1 : 0
    total += 1
    checked += done
    byCategory[item.category] ??= { total: 0, checked: 0 }
    byCategory[item.category].total += 1
    byCategory[item.category].checked += done
    if (item.required) {
      requiredTotal += 1
      requiredChecked += done
    }
  }
  return {
    total,
    checked,
    requiredTotal,
    requiredChecked,
    percent: total ? Math.floor((checked / total) * 100 + 0.5) : 0,
    byCategory,
  }
}

/** 동그라미 체크 = 수령(received). 수령이던 항목의 체크를 풀면 대기(not_entered)로 */
export function applyCheck(state: ChecklistItemState, checked: boolean): ChecklistItemPatch & Partial<ChecklistItemState> {
  if (checked) return { checked: true, status: 'received' }
  return { checked: false, status: isReceived(state.status) ? 'not_entered' : (state.status as PatchStatus) }
}

/** 상태 드롭다운 — 수령을 고르면 체크, 다른 상태면 체크 해제 */
export function applyStatus(_state: ChecklistItemState, status: PatchStatus): ChecklistItemPatch & Partial<ChecklistItemState> {
  return { status, checked: isReceived(status) }
}

/** 키트 filter_items와 같다: 검색(ID·항목명·이유), 「필수」, 「미완료」(수령·해당 없음 제외) */
export function filterItems(
  items: ChecklistItem[],
  states: ChecklistItemState[],
  filter: ChecklistFilter,
  query: string,
): ChecklistItem[] {
  const byId = new Map(states.map((s) => [s.itemId, s]))
  const q = query.trim().toLowerCase()
  return items.filter((item) => {
    const status = byId.get(item.id)?.status
    if (filter === 'required' && !item.required) return false
    if (filter === 'unchecked' && (isReceived(status) || status === 'na')) return false
    return !q || `${item.id} ${item.label} ${item.description}`.toLowerCase().includes(q)
  })
}

/** 섹션 전체 체크 박스 상태 (na 제외) */
export function sectionCheckState(items: ChecklistItem[], states: ChecklistItemState[]): 'all' | 'some' | 'none' {
  const byId = new Map(states.map((s) => [s.itemId, s]))
  const active = items.filter((i) => byId.get(i.id)?.status !== 'na')
  const done = active.filter((i) => byId.get(i.id)?.checked).length
  if (active.length > 0 && done === active.length) return 'all'
  return done > 0 ? 'some' : 'none'
}

export function mergeState(
  states: ChecklistItemState[],
  itemId: string,
  patch: Partial<ChecklistItemState>,
): ChecklistItemState[] {
  return states.map((s) => (s.itemId === itemId ? { ...s, ...patch } : s))
}
