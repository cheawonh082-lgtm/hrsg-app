import { useCallback } from 'react'

import { newId, useChatStore } from '../../store/chat'
import { ApiError, apiFetch } from '../client'
import type { CalcInput, ChatRequest, ChatResponse } from '../types'

export type PartialCalcInput = {
  gtModelId?: string
  condition?: Partial<CalcInput['condition']>
  economics?: Partial<CalcInput['economics']>
}

/**
 * 질문 전송. 사용자 메시지와 '응답 대기' 메시지를 먼저 추가하고, 응답이 오면 교체한다.
 * - ask(text): 새 질문 (계산기 맥락이 있으면 calcContext.calcId 동봉)
 * - resend(request, input): 확인 카드 "계산 실행" — 같은 질문에 확인값을 calcContext.input으로 담아 다시 보냄
 */
export function useChat() {
  const { sessionId, calcContextId, add, update } = useChatStore()

  const send = useCallback(
    async (request: ChatRequest, userText?: string) => {
      if (userText) add({ id: newId(), role: 'user', text: userText })
      const id = newId()
      add({ id, role: 'assistant', request, status: 'pending' })
      try {
        const response = await apiFetch<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify(request) })
        update(id, { status: 'done', response })
      } catch (e) {
        update(id, { status: 'error', errorCode: e instanceof ApiError ? e.code : 'UNKNOWN' })
      }
    },
    [add, update],
  )

  const ask = useCallback(
    (text: string) => {
      const message = text.trim()
      if (!message) return
      const calcContext = calcContextId ? { calcId: calcContextId } : undefined
      return send({ sessionId, message, calcContext }, message)
    },
    [send, sessionId, calcContextId],
  )

  const resend = useCallback(
    (request: ChatRequest, input: PartialCalcInput) =>
      send({ ...request, calcContext: { ...request.calcContext, input } }),
    [send],
  )

  const retry = useCallback((request: ChatRequest) => send(request), [send])

  return { ask, resend, retry }
}
