import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'

import { type CalcPreset, calcDefaultsQuery, useGtModels, useInputLimits } from '../api/hooks/useCalc'
import { type CalcDraft, toDraft } from '../lib/calcDraft'
import { useCalculatorStore } from '../store/calculator'
import { useCalculate } from './useCalculate'

/**
 * 계산기 입력값(스토어) + 계산 결과. 계산기·홈 대시보드가 같은 입력으로 같은 결과를 보여 준다.
 * 입력값이 아직 없으면 첫 GT 모델의 예시 운전 상태(키트 defaultInputs)로 채운다(skipInit이면 기다림 — 예: calcId 복원 중).
 */
export function useCalculatorDraft({ skipInit = false }: { skipInit?: boolean } = {}) {
  const queryClient = useQueryClient()
  const models = useGtModels()
  const limits = useInputLimits()
  const draft = useCalculatorStore((s) => s.draft)
  const setDraft = useCalculatorStore((s) => s.setDraft)
  const calc = useCalculate(draft, limits.data)

  /**
   * 모델 선택 → 그 등급의 예시 운전 상태(키트 defaultInputs), 「초기화」 → 설계 상태(키트 designInputs, preset 'design').
   * keepEconomics를 주면 경제성 입력은 유지한다.
   */
  const loadModel = useCallback(
    async (gtModelId: string, keepEconomics?: CalcDraft['economics'], preset: CalcPreset = 'example') => {
      try {
        const defaults = toDraft(await queryClient.fetchQuery(calcDefaultsQuery(gtModelId, preset)))
        setDraft(keepEconomics ? { ...defaults, economics: keepEconomics } : defaults)
      } catch {
        // 연결 오류는 AppShell 배너가 안내한다
      }
    },
    [queryClient, setDraft],
  )

  useEffect(() => {
    if (!draft && !skipInit && models.data?.length) void loadModel(models.data[0].modelId)
  }, [draft, skipInit, models.data, loadModel])

  return { models, limits, draft, setDraft, calc, loadModel }
}
