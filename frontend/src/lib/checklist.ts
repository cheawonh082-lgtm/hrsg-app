import type {
  ChecklistCategory,
  ChecklistItem,
  ChecklistItemState,
  ChecklistProgress,
  ItemStatus,
} from '../api/types'

export type ChecklistFilter = 'all' | 'required' | 'unchecked'

/**
 * 진행률 — 서버 app/checklist/service.py compute_progress와 같은 규칙.
 * 낙관적 업데이트 때 서버 응답을 기다리지 않고 바로 다시 계산하는 데 쓴다.
 * '해당 없음(na)'은 분모·분자 모두에서 뺀다.
 */
export function computeProgress(
  items: ChecklistItem[],
  states: ChecklistItemState[],
  categories: ChecklistCategory[],
): ChecklistProgress {
  const byId = new Map(states.map((s) => [s.itemId, s]))
  const byCategory = Object.fromEntries(categories.map((c) => [c, { total: 0, checked: 0 }])) as ChecklistProgress['byCategory']
  let total = 0
  let checked = 0
  let requiredTotal = 0
  let requiredChecked = 0
  for (const item of items) {
    const state = byId.get(item.id)
    if (state?.status === 'na') continue
    const done = state?.checked ? 1 : 0
    total += 1
    checked += done
    byCategory[item.category] ??= { total: 0, checked: 0 }
    byCategory[item.category].total += 1
    byCategory[item.category].checked += done
    if (item.priority === 'required') {
      requiredTotal += 1
      requiredChecked += done
    }
  }
  return {
    total,
    checked,
    requiredTotal,
    requiredChecked,
    percent: total ? Math.round((checked / total) * 100) : 0,
    byCategory,
  }
}

/** 체크하면 '받음', 받음이던 항목의 체크를 풀면 '대기'로 */
export function applyCheck(state: ChecklistItemState, checked: boolean): Partial<ChecklistItemState> {
  if (checked) return { checked: true, status: 'received' }
  return { checked: false, status: state.status === 'received' ? 'pending' : state.status }
}

/** '받음'을 고르면 자동 체크, 받음에서 다른 상태로 바꾸면 체크 해제 */
export function applyStatus(state: ChecklistItemState, status: ItemStatus): Partial<ChecklistItemState> {
  if (status === 'received') return { status, checked: true }
  if (state.status === 'received' && state.checked) return { status, checked: false }
  return { status }
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')

export function filterItems(
  items: ChecklistItem[],
  states: ChecklistItemState[],
  filter: ChecklistFilter,
  query: string,
): ChecklistItem[] {
  const byId = new Map(states.map((s) => [s.itemId, s]))
  const q = normalize(query)
  return items.filter((item) => {
    const state = byId.get(item.id)
    if (filter === 'required' && item.priority !== 'required') return false
    if (filter === 'unchecked' && (state?.checked || state?.status === 'na')) return false
    if (!q) return true
    return [item.label, item.description, item.period].some((t) => t && normalize(t).includes(q))
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
