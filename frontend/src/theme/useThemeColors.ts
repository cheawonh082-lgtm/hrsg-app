import { useEffect, useState } from 'react'

export interface ThemeColors {
  text: string
  muted: string
  border: string
  surface: string
  accent: string
  normal: string
  caution: string
  danger: string
  toneBlue: string
  toneGreen: string
  tonePurple: string
}

function read(): ThemeColors {
  const style = getComputedStyle(document.documentElement)
  const v = (name: string) => style.getPropertyValue(name).trim()
  return {
    text: v('--text'),
    muted: v('--muted'),
    border: v('--border'),
    surface: v('--surface'),
    accent: v('--accent'),
    normal: v('--status-normal'),
    caution: v('--status-caution'),
    danger: v('--status-danger'),
    toneBlue: v('--tone-blue'),
    toneGreen: v('--tone-green'),
    tonePurple: v('--tone-purple'),
  }
}

/** 캔버스 차트(ECharts)·SVG용 테마 색. <html class="dark"> 변경 시 다시 읽는다. */
export function useThemeColors() {
  const [colors, setColors] = useState(read)

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return colors
}
