import { useState } from 'react'

/** 값이 바뀌기 직전의 값 (같은 값으로 다시 렌더링될 때는 유지) */
export function usePreviousDistinct<T>(value: T): T | undefined {
  const [state, setState] = useState<{ current: T; previous?: T }>({ current: value })
  if (!Object.is(value, state.current)) {
    setState({ current: value, previous: state.current })
    return state.current
  }
  return state.previous
}
