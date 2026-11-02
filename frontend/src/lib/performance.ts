import type { CalcResult, CleaningMethodComparison, SectionHealth, SectionId, StatusLevel, StatusThresholds } from '../api/types'
import { absoluteBand } from './thresholds'

/** 상태 심각도 순서 — 묶음 상태는 가장 나쁜 섹션을 따른다 */
const RANK: Record<StatusLevel, number> = { normal: 0, caution: 1, danger: 2 }

export function worstStatus(list: (StatusLevel | null | undefined)[]): StatusLevel {
  return list.reduce<StatusLevel>((worst, s) => (s && RANK[s] > RANK[worst] ? s : worst), 'normal')
}

/** 간략 도식용 열교환기 묶음 (가스 흐름 순서) */
export const BUNDLES: { id: 'superheater' | 'evaporator' | 'economizer'; sections: SectionId[] }[] = [
  { id: 'superheater', sections: ['HP_SH', 'RH', 'IP_SH', 'LP_SH'] },
  { id: 'evaporator', sections: ['HP_EVA', 'IP_EVA', 'LP_EVA'] },
  { id: 'economizer', sections: ['HP_ECO', 'IP_ECO', 'CPH'] },
]

export function bundleStatus(sections: SectionHealth[], ids: SectionId[]) {
  return worstStatus(sections.filter((s) => ids.includes(s.sectionId)).map((s) => s.status))
}

/**
 * 열회수 효율(%) — 배기가스가 대기온도까지 식을 때의 열 중 HRSG가 회수한 비율.
 * η = (배기온도 − 스택온도) / (배기온도 − 대기온도). 계산 엔진 출력이 아니라 입력·결과에서 유도한 표시용 값.
 */
export function heatRecoveryPct(exhaustTempC: number, ambientTempC: number, stackTempC: number) {
  const span = exhaustTempC - ambientTempC
  return span > 0 ? ((exhaustTempC - stackTempC) / span) * 100 : 0
}

export interface EfficiencySummary {
  design: number
  current: number
  afterCleaning: number
  /** 스택 온도 주의 임계값에 해당하는 효율 (이 아래로 떨어지면 주의) */
  caution: number | null
  status: StatusLevel
}

export function efficiencySummary(result: CalcResult, thresholds?: StatusThresholds): EfficiencySummary {
  const { exhaustTempC, ambientTempC, stackTempC } = result.input.condition
  const stack = result.current.metrics.find((m) => m.key === 'stackTemp')
  const designStack = stack?.baseline ?? stackTempC
  const eta = (t: number) => heatRecoveryPct(exhaustTempC, ambientTempC, t)
  return {
    design: eta(designStack),
    current: eta(stackTempC),
    afterCleaning: eta(result.recovery.expectedStackTempAfterC),
    caution: thresholds ? eta(absoluteBand(designStack, thresholds.stackTemp).caution) : null,
    status: stack?.status ?? 'normal',
  }
}

/** 운전 이력이 없어 설계(세정 직후) → 현재를 보간한 월별 추정 곡선 */
export const TREND_MONTHS = 12

export function efficiencyTrend(summary: EfficiencySummary) {
  return Array.from({ length: TREND_MONTHS + 1 }, (_, m) => {
    // 오염은 초기에 느리고 갈수록 빨라지는 경향 — 1.3승 곡선으로 보간
    const f = Math.pow(m / TREND_MONTHS, 1.3)
    return summary.design + (summary.current - summary.design) * f
  })
}

/** KPI에 쓸 대표 세정 공법 — 추천 공법, 없으면 순편익이 가장 큰 공법 */
export function representativeMethod(rows: CleaningMethodComparison[]) {
  return rows.find((r) => r.recommended) ?? [...rows].sort((a, b) => b.netBenefitKrw - a.netBenefitKrw)[0]
}
