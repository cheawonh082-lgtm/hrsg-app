import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { keyboardInset, useVisualViewport } from './useVisualViewport'

class FakeViewport extends EventTarget {
  height = 740
  offsetTop = 0
}

const original = Object.getOwnPropertyDescriptor(window, 'visualViewport')

afterEach(() => {
  if (original) Object.defineProperty(window, 'visualViewport', original)
  else delete (window as { visualViewport?: unknown }).visualViewport
})

describe('keyboardInset', () => {
  it('보이는 영역이 줄어든 만큼이 키보드 높이', () => {
    expect(keyboardInset({ height: 440, offsetTop: 0 }, 740)).toBe(300)
  })

  it('스크롤로 보이는 영역이 내려가면 그만큼 뺀다', () => {
    expect(keyboardInset({ height: 440, offsetTop: 100 }, 740)).toBe(200)
  })

  it('주소창 접힘 같은 작은 차이는 무시', () => {
    expect(keyboardInset({ height: 690, offsetTop: 0 }, 740)).toBe(0)
  })
})

describe('useVisualViewport', () => {
  it('visualViewport resize 이벤트에 따라 키보드 상태를 갱신한다', () => {
    const vv = new FakeViewport()
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 740, configurable: true })

    const { result } = renderHook(() => useVisualViewport())
    expect(result.current).toEqual({ keyboardInset: 0, keyboardOpen: false })

    act(() => {
      vv.height = 420
      vv.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toEqual({ keyboardInset: 320, keyboardOpen: true })

    act(() => {
      vv.height = 740
      vv.dispatchEvent(new Event('resize'))
    })
    expect(result.current.keyboardOpen).toBe(false)
  })

  it('visualViewport가 없는 브라우저에서는 0', () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
    const { result } = renderHook(() => useVisualViewport())
    expect(result.current.keyboardInset).toBe(0)
  })
})
