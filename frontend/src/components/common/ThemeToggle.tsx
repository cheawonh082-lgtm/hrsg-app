import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { type ThemePref, useUiStore } from '../../store/ui'

const NEXT: Record<ThemePref, ThemePref> = { light: 'dark', dark: 'system', system: 'light' }
const ICON = { light: Sun, dark: Moon, system: Monitor }

/** 라이트 → 다크 → 시스템 순환 토글 */
export function ThemeToggle() {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const Icon = ICON[theme]
  const label = `${t('theme.label')}: ${t('theme.change', { current: t(`theme.${theme}`) })}`

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={label}
      title={label}
      className="flex size-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Icon aria-hidden className="size-5" />
    </button>
  )
}
