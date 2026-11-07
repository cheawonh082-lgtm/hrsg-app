import { beforeEach, describe, expect, it } from 'vitest'

import type { ChatRequest } from '../api/types'
import { STORAGE_KEY, useChatStore } from './chat'

const req = (sessionId: string): ChatRequest => ({ sessionId, message: 'q' }) as ChatRequest
const s = () => useChatStore.getState()

describe('대화 기록 저장소', () => {
  beforeEach(() => {
    localStorage.clear()
    s().clearAll()
  })

  it('첫 메시지를 보내면 기록에 추가되고 제목은 첫 질문이다', () => {
    s().add({ id: 'u1', role: 'user', text: '  핀치   포인트란? ' })
    expect(s().conversations).toHaveLength(1)
    expect(s().conversations[0]).toMatchObject({ id: s().sessionId, title: '핀치 포인트란?' })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.conversations).toHaveLength(1)
  })

  it('새 대화 후 이전 대화를 다시 열 수 있고, 다른 대화에 있을 때 온 답변도 원래 대화에 반영된다', () => {
    s().add({ id: 'u1', role: 'user', text: '첫 대화' })
    const firstId = s().sessionId
    s().add({ id: 'a1', role: 'assistant', request: req(firstId), status: 'pending' })

    s().reset()
    expect(s().messages).toHaveLength(0)
    s().update('a1', { status: 'done' })

    s().select(firstId)
    expect(s().sessionId).toBe(firstId)
    expect(s().messages.at(-1)).toMatchObject({ id: 'a1', status: 'done' })
  })

  it('보고 있는 대화를 지우면 새 대화로 바뀐다', () => {
    s().add({ id: 'u1', role: 'user', text: 'x' })
    const id = s().sessionId
    s().remove(id)
    expect(s().conversations).toHaveLength(0)
    expect(s().sessionId).not.toBe(id)
    expect(s().messages).toHaveLength(0)
  })

  it('저장된 응답 대기 메시지는 불러올 때 오류로 바뀐다', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          conversations: [
            {
              id: 'c1',
              title: 't',
              createdAt: 1,
              updatedAt: 1,
              calcContextId: null,
              messages: [{ id: 'a1', role: 'assistant', request: req('c1'), status: 'pending' }],
            },
          ],
        },
      }),
    )
    await useChatStore.persist.rehydrate()
    expect(s().conversations[0].messages[0]).toMatchObject({ status: 'error', errorCode: 'INTERRUPTED' })
  })
})
