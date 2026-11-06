import type { StatusLevel } from '../api/types'

/** 상태 심각도 순서 — 묶음 상태는 가장 나쁜 쪽을 따른다 */
const RANK: Record<StatusLevel, number> = { normal: 0, caution: 1, danger: 2 }

export function worstStatus(list: (StatusLevel | null | undefined)[]): StatusLevel {
  return list.reduce<StatusLevel>((worst, s) => (s && RANK[s] > RANK[worst] ? s : worst), 'normal')
}

/**
 * 간략 도식용 열교환기 묶음 (가스 흐름 순서). 표시 오염도는 키트 r.display_fouling 의 같은 이름 값(0~1).
 * 효율·손실 계산은 백엔드(키트 calc.py)가 하고, 프론트에는 식을 두지 않는다.
 */
export const BUNDLES = ['superheater', 'evaporator', 'economizer'] as const
export type BundleId = (typeof BUNDLES)[number]
