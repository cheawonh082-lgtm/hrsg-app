// schema.d.ts(자동 생성)에서 자주 쓰는 타입만 이름 붙여 내보낸다. 직접 타입을 다시 정의하지 말 것.
import type { components } from './schema'

type Schemas = components['schemas']

export type HealthStatus = Schemas['HealthStatus']
export type GasTurbineSpec = Schemas['GasTurbineSpec']
export type CalcInput = Schemas['CalcInput']
export type CalcResult = Schemas['CalcResult']
export type Metric = Schemas['Metric']
export type SectionHealth = Schemas['SectionHealth']
export type SectionId = SectionHealth['sectionId']
export type SensitivitySeries = Schemas['SensitivitySeries']
export type CleaningMethodComparison = Schemas['CleaningMethodComparison']
export type PinchApproachEvaluation = Schemas['PinchApproachEvaluation']
export type StatusThresholds = Schemas['StatusThresholds']
export type ThresholdBand = Schemas['ThresholdBand']
export type InputLimits = Schemas['InputLimits']
export type FieldLimit = Schemas['FieldLimit']
export type StatusLevel = CalcResult['current']['overallStatus']

export type ConditionKey = keyof CalcInput['condition']
export type EconomicsKey = keyof CalcInput['economics']
