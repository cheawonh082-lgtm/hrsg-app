import type { ConditionKey, EconomicsKey } from '../../api/types'
import type { DraftGroup } from '../../lib/calcDraft'

/**
 * 입력 필드 UI 정의. 슬라이더 범위는 조작 편의를 위한 값일 뿐이며,
 * 허용 범위(검증)는 백엔드 /api/calc/input-limits 가 결정한다.
 */
export interface FieldDef {
  group: DraftGroup
  key: ConditionKey | EconomicsKey
  /** '@'로 시작하면 i18n 단위 키 (calc.units.*) */
  unit: string
  slider: { min: number; max: number; step: number }
}

export type FieldGroupId = 'primary' | 'operation' | 'advanced' | 'economics'

const c = (key: ConditionKey, unit: string, min: number, max: number, step: number): FieldDef => ({
  group: 'condition',
  key,
  unit,
  slider: { min, max, step },
})
const e = (key: EconomicsKey, unit: string, min: number, max: number, step: number): FieldDef => ({
  group: 'economics',
  key,
  unit,
  slider: { min, max, step },
})

export const FIELD_GROUPS: { id: FieldGroupId; fields: FieldDef[] }[] = [
  {
    id: 'primary',
    fields: [
      c('hrsgGasDpMbar', 'mbar', 0, 80, 0.5),
      c('gtBackPressureMbar', 'mbar', 0, 80, 0.5),
      c('stackTempC', '℃', 60, 200, 1),
    ],
  },
  {
    id: 'operation',
    fields: [
      c('gtLoadPct', '%', 30, 100, 1),
      c('exhaustTempC', '℃', 450, 680, 1),
      c('exhaustFlowKgS', 'kg/s', 200, 1200, 5),
      c('ambientTempC', '℃', -20, 45, 1),
    ],
  },
  {
    id: 'advanced',
    fields: [
      c('hpSteamFlowKgS', 'kg/s', 0, 200, 0.5),
      c('ipSteamFlowKgS', 'kg/s', 0, 60, 0.5),
      c('lpSteamFlowKgS', 'kg/s', 0, 40, 0.5),
      c('hpDrumPressureBarg', 'barg', 0, 200, 0.5),
      c('hpEvapGasOutTempC', '℃', 200, 450, 0.1),
      c('hpEcoWaterOutTempC', '℃', 200, 380, 0.1),
    ],
  },
  {
    id: 'economics',
    fields: [
      e('electricityPriceKrwPerMwh', 'KRW/MWh', 30000, 400000, 1000),
      e('annualOperatingHours', 'h', 0, 8760, 10),
      e('analysisPeriodYears', '@years', 1, 20, 1),
    ],
  },
]
