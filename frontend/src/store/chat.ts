import { create } from 'zustand'

import type { ChatRequest, ChatResponse } from '../api/types'

export type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | {
      id: string
      role: 'assistant'
      /** 같은 질문을 다시 보낼 때(재시도·확인 카드 "계산 실행") 쓰는 원래 요청 */
      request: ChatRequest
      status: 'pending' | 'done' | 'error'
      response?: ChatResponse
      errorCode?: string
    }

export type AssistantMessage = Extract<ChatMessage, { role: 'assistant' }>

interface ChatState {
  sessionId: string
  messages: ChatMessage[]
  /** 계산기에서 넘어온 결과 ID — 사용자가 지우기 전까지 질문에 함께 보낸다 */
  calcContextId: string | null
  add: (message: ChatMessage) => void
  update: (id: string, patch: Partial<AssistantMessage>) => void
  setCalcContextId: (id: string | null) => void
  reset: () => void
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

/** 대화는 세션 동안만 메모리에 둔다(화면 이동 시 유지, 새로고침 시 초기화). 다중 대화 목록은 추후. */
export const useChatStore = create<ChatState>()((set) => ({
  sessionId: newId(),
  messages: [],
  calcContextId: null,
  add: (message) => set((s) => ({ messages: [...s.messages, message] })),
  update: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, ...patch } : m)),
    })),
  setCalcContextId: (calcContextId) => set({ calcContextId }),
  reset: () => set({ sessionId: newId(), messages: [], calcContextId: null }),
}))

export { newId }
