import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'

import { apiFetch } from '../client'
import type { CalcInput, CalcResult, GasTurbineSpec, InputLimits } from '../types'

/** example: 키트 defaultInputs (처음 화면, 예시 운전 상태) / design: 키트 designInputs (「초기화」, 손실 0) */
export type CalcPreset = 'example' | 'design'

export function useGtModels() {
  return useQuery({
    queryKey: ['calc', 'gt-models'],
    queryFn: () => apiFetch<GasTurbineSpec[]>('/api/calc/gt-models'),
    staleTime: Infinity,
  })
}

export function calcDefaultsQuery(gtModelId: string, preset: CalcPreset = 'example') {
  return queryOptions({
    queryKey: ['calc', 'defaults', gtModelId, preset],
    queryFn: () =>
      apiFetch<CalcInput>(`/api/calc/defaults?gtModelId=${encodeURIComponent(gtModelId)}&preset=${preset}`),
    staleTime: Infinity,
  })
}

/** 입력 범위 — 백엔드 Pydantic 스키마에서 추출한 값. zod 검증에 사용 */
export function useInputLimits() {
  return useQuery({
    queryKey: ['calc', 'input-limits'],
    queryFn: () => apiFetch<InputLimits>('/api/calc/input-limits'),
    staleTime: Infinity,
  })
}

/** 같은 입력이면 같은 결과(결정적)이므로 query로 캐시. 재계산 중에는 이전 값 유지(R-13). */
export function useEvaluate(input: CalcInput | undefined) {
  return useQuery({
    queryKey: ['calc', 'evaluate', input],
    queryFn: () => apiFetch<CalcResult>('/api/calc/evaluate', { method: 'POST', body: JSON.stringify(input) }),
    enabled: !!input,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** 저장된 계산 결과 — 챗 카드의 "계산기에서 열기"가 같은 calcId의 입력을 복원할 때 사용 (A-09) */
export function useCalcResult(calcId: string | null) {
  return useQuery({
    queryKey: ['calc', 'results', calcId],
    queryFn: () => apiFetch<CalcResult>(`/api/calc/results/${encodeURIComponent(calcId!)}`),
    enabled: !!calcId,
    staleTime: Infinity,
    retry: false,
  })
}
