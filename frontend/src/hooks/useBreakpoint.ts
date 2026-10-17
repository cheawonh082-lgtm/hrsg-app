import { useSyncExternalStore } from 'react'

/** PRD §3.4.1 브레이크포인트(px). Tailwind 기본값(sm 40rem …)과 동일하게 유지할 것. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const

export type Breakpoint = 'base' | keyof typeof BREAKPOINTS

const RANK: Record<Breakpoint, number> = { base: 0, sm: 1, md: 2, lg: 3, xl: 4 }
const DESCENDING = (['xl', 'lg', 'md', 'sm'] as const).map((bp) => ({
  bp,
  // Tailwind와 같은 rem 단위 → 브라우저 기본 글자 크기를 바꿔도 CSS 분기와 어긋나지 않음
  mql: window.matchMedia(`(min-width: ${BREAKPOINTS[bp] / 16}rem)`),
}))

function getSnapshot(): Breakpoint {
  return DESCENDING.find(({ mql }) => mql.matches)?.bp ?? 'base'
}

function subscribe(onChange: () => void) {
  DESCENDING.forEach(({ mql }) => mql.addEventListener('change', onChange))
  return () => DESCENDING.forEach(({ mql }) => mql.removeEventListener('change', onChange))
}

/**
 * 현재 브레이크포인트. 컴포넌트를 통째로 바꿔야 할 때(도식 방향, 표↔카드, 패널↔시트)만 사용하고,
 * 단순 배치 변경은 Tailwind 반응형 클래스로 처리한다 (PRD §3.4.4).
 */
export function useBreakpoint() {
  const bp = useSyncExternalStore(subscribe, getSnapshot, () => 'base' as const)
  return {
    bp,
    isMobile: RANK[bp] < RANK.md,
    isTablet: bp === 'md',
    isDesktop: RANK[bp] >= RANK.lg,
    atLeast: (target: Breakpoint) => RANK[bp] >= RANK[target],
  }
}
