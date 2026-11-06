import { describe, expect, it } from 'vitest'

import type { ChecklistItem, ChecklistItemState } from '../api/types'
import { applyCheck, applyStatus, computeProgress, filterItems, mergeState, sectionCheckState } from './checklist'

/** 키트 data/checklist.json 형식의 항목 몇 개 */
const item = (id: string, required: boolean, label: string, description = ''): ChecklistItem => ({
  id,
  category: id[0],
  kind: 'operation',
  required,
  priority: required ? 'required' : 'recommended',
  priorityLevel: required ? 'high' : 'medium',
  label,
  description,
  detail: description,
})
const state = (itemId: string, patch: Partial<ChecklistItemState> = {}): ChecklistItemState => ({
  itemId,
  checked: false,
  status: 'not_entered',
  ...patch,
})

const items = [
  item('A-01', true, 'GT 모델 및 정격 용량', '출력 손실·정지 손실 계산의 기준 용량'),
  item('A-02', true, '운전 배압', '초과 배압과 출력 손실 계산'),
  item('B-06', false, '증발기 출구 가스 온도', '핀치 온도차 계산'),
  item('B-13', false, 'P&ID', '계측 위치 확인'),
]
const categories = ['A', 'B']

describe('computeProgress (키트 summary 규칙)', () => {
  it('전체·필수·카테고리 진행률을 따로 센다', () => {
    const p = computeProgress(items, [state('A-01', { checked: true, status: 'received' }), state('B-06', { checked: true, status: 'received' })], categories)
    expect(p).toMatchObject({ total: 4, checked: 2, requiredTotal: 2, requiredChecked: 1, percent: 50 })
    expect(p.byCategory.A).toEqual({ total: 2, checked: 1 })
    expect(p.byCategory.B).toEqual({ total: 2, checked: 1 })
  })

  it("'해당 없음'은 분모에서 뺀다", () => {
    const p = computeProgress(items, [state('B-13', { status: 'na' })], categories)
    expect(p.total).toBe(3)
    expect(p.byCategory.B).toEqual({ total: 1, checked: 0 })
  })

  it("'검증 필요'도 수령으로 센다", () => {
    expect(computeProgress(items, [state('A-02', { status: 'verify_needed', checked: true })], categories).checked).toBe(1)
  })

  it('1/49 → 2% (소수 첫째 자리 반올림)', () => {
    const many = Array.from({ length: 49 }, (_, i) => item(`E-${i}`, false, `항목 ${i}`))
    expect(computeProgress(many, [state('E-0', { status: 'received', checked: true })], ['E']).percent).toBe(2)
    expect(computeProgress([], [], []).percent).toBe(0)
  })
})

describe('체크·상태 연동 (체크 = 수령)', () => {
  it('체크하면 수령, 수령 항목 체크 해제는 대기', () => {
    expect(applyCheck(state('a'), true)).toEqual({ checked: true, status: 'received' })
    expect(applyCheck(state('a', { checked: true, status: 'received' }), false)).toEqual({ checked: false, status: 'not_entered' })
  })

  it('요청함 상태에서 체크 해제해도 요청함은 유지', () => {
    expect(applyCheck(state('a', { status: 'requested' }), false)).toEqual({ checked: false, status: 'requested' })
  })

  it('수령을 고르면 체크, 다른 상태면 체크 해제', () => {
    expect(applyStatus(state('a'), 'received')).toEqual({ status: 'received', checked: true })
    expect(applyStatus(state('a', { checked: true, status: 'received' }), 'requested')).toEqual({ status: 'requested', checked: false })
    expect(applyStatus(state('a'), 'na')).toEqual({ status: 'na', checked: false })
  })
})

describe('filterItems (키트 filter_items 규칙)', () => {
  const states = [state('A-01', { checked: true, status: 'received' }), state('B-13', { status: 'na' })]

  it('필수만', () => {
    expect(filterItems(items, states, 'required', '').map((i) => i.id)).toEqual(['A-01', 'A-02'])
  })

  it('미완료: 수령과 해당 없음 제외', () => {
    expect(filterItems(items, states, 'unchecked', '').map((i) => i.id)).toEqual(['A-02', 'B-06'])
  })

  it('검색은 ID·항목명·이유, 대소문자 무시', () => {
    expect(filterItems(items, states, 'all', '핀치').map((i) => i.id)).toEqual(['B-06'])
    expect(filterItems(items, states, 'all', 'b-13').map((i) => i.id)).toEqual(['B-13'])
    expect(filterItems(items, states, 'all', 'p&id').map((i) => i.id)).toEqual(['B-13'])
  })
})

describe('sectionCheckState', () => {
  const a = items.slice(0, 2)
  it('전부/일부/없음 (na 제외)', () => {
    expect(sectionCheckState(a, [state('A-01', { checked: true })])).toBe('some')
    expect(sectionCheckState(a, [state('A-01', { checked: true }), state('A-02', { status: 'na' })])).toBe('all')
    expect(sectionCheckState(a, [])).toBe('none')
  })
})

it('mergeState는 해당 항목만 바꾼다', () => {
  const merged = mergeState([state('a'), state('b')], 'b', { memo: '메모' })
  expect(merged).toEqual([state('a'), state('b', { memo: '메모' })])
})
