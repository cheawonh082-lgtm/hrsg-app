import { describe, expect, it } from 'vitest'

import type { ChecklistItem, ChecklistItemState } from '../api/types'
import { applyCheck, applyStatus, computeProgress, filterItems, mergeState, sectionCheckState } from './checklist'

const item = (id: string, category: ChecklistItem['category'], priority: ChecklistItem['priority'], label = id): ChecklistItem => ({
  id,
  category,
  priority,
  kind: 'operating',
  labelKey: `checklist.items.${id}`,
  label,
})
const state = (itemId: string, patch: Partial<ChecklistItemState> = {}): ChecklistItemState => ({
  itemId,
  checked: false,
  status: 'pending',
  ...patch,
})

const items = [
  item('gt.model', 'gas_turbine', 'required', 'GT 모델 및 정격 출력'),
  item('gt.back_pressure', 'gas_turbine', 'required', 'GT 배압 측정값'),
  item('exh.composition', 'exhaust_gas', 'recommended', '배기가스 성분'),
  item('doc.pid', 'design_docs', 'optional', 'P&ID'),
]
const categories = ['gas_turbine', 'exhaust_gas', 'design_docs'] as const

describe('computeProgress', () => {
  it('전체·필수·카테고리 진행률을 따로 센다', () => {
    const p = computeProgress(items, [state('gt.model', { checked: true }), state('exh.composition', { checked: true })], [...categories])
    expect(p).toMatchObject({ total: 4, checked: 2, requiredTotal: 2, requiredChecked: 1, percent: 50 })
    expect(p.byCategory.gas_turbine).toEqual({ total: 2, checked: 1 })
    expect(p.byCategory.exhaust_gas).toEqual({ total: 1, checked: 1 })
  })

  it("'해당 없음'은 분모·분자에서 뺀다", () => {
    const p = computeProgress(items, [state('doc.pid', { status: 'na', checked: true })], [...categories])
    expect(p.total).toBe(3)
    expect(p.checked).toBe(0)
    expect(p.byCategory.design_docs).toEqual({ total: 0, checked: 0 })
  })

  it('항목이 없으면 0%', () => {
    expect(computeProgress([], [], []).percent).toBe(0)
  })

  it('반올림한 정수 퍼센트', () => {
    const three = items.slice(0, 3)
    expect(computeProgress(three, [state('gt.model', { checked: true })], [...categories]).percent).toBe(33)
  })
})

describe('체크·상태 연동', () => {
  it('체크하면 받음, 받음 항목 체크 해제는 대기', () => {
    expect(applyCheck(state('a'), true)).toEqual({ checked: true, status: 'received' })
    expect(applyCheck(state('a', { checked: true, status: 'received' }), false)).toEqual({ checked: false, status: 'pending' })
  })

  it('요청함 상태에서 체크 해제해도 요청함은 유지', () => {
    expect(applyCheck(state('a', { checked: true, status: 'requested' }), false)).toEqual({ checked: false, status: 'requested' })
  })

  it('받음을 고르면 체크, 받음에서 벗어나면 체크 해제', () => {
    expect(applyStatus(state('a'), 'received')).toEqual({ status: 'received', checked: true })
    expect(applyStatus(state('a', { checked: true, status: 'received' }), 'requested')).toEqual({ status: 'requested', checked: false })
    expect(applyStatus(state('a'), 'na')).toEqual({ status: 'na' })
  })
})

describe('filterItems', () => {
  const states = [state('gt.model', { checked: true }), state('doc.pid', { status: 'na' })]

  it('필수만', () => {
    expect(filterItems(items, states, 'required', '').map((i) => i.id)).toEqual(['gt.model', 'gt.back_pressure'])
  })

  it('미완료: 체크된 항목과 해당 없음 제외', () => {
    expect(filterItems(items, states, 'unchecked', '').map((i) => i.id)).toEqual(['gt.back_pressure', 'exh.composition'])
  })

  it('검색은 대소문자·공백 무시', () => {
    expect(filterItems(items, states, 'all', 'gt배압').map((i) => i.id)).toEqual(['gt.back_pressure'])
    expect(filterItems(items, states, 'all', 'p&id').map((i) => i.id)).toEqual(['doc.pid'])
  })
})

describe('sectionCheckState', () => {
  const gt = items.slice(0, 2)
  it('전부/일부/없음 (na 제외)', () => {
    expect(sectionCheckState(gt, [state('gt.model', { checked: true })])).toBe('some')
    expect(sectionCheckState(gt, [state('gt.model', { checked: true }), state('gt.back_pressure', { status: 'na' })])).toBe('all')
    expect(sectionCheckState(gt, [])).toBe('none')
  })
})

it('mergeState는 해당 항목만 바꾼다', () => {
  const merged = mergeState([state('a'), state('b')], 'b', { memo: '메모' })
  expect(merged).toEqual([state('a'), state('b', { memo: '메모' })])
})
