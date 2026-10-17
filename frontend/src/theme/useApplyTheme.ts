import { useEffect } from 'react'

import { useUiStore } from '../store/ui'

/** 선택한 테마를 <html class="dark">에 반영. 'system'이면 OS 설정 변경도 따라간다. */
export function useApplyTheme() {
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mql.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    if (theme !== 'system') return
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [theme])
}
