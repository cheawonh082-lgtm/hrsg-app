import { create } from 'zustand'

import type { CalcDraft } from '../lib/calcDraft'

/** 계산기 입력값. 다른 화면(질문하기 등)에 다녀와도 유지되도록 스토어에 둔다. */
interface CalculatorState {
  draft: CalcDraft | null
  setDraft: (draft: CalcDraft) => void
}

export const useCalculatorStore = create<CalculatorState>()((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
}))
