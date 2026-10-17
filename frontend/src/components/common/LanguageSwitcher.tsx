import { useTranslation } from 'react-i18next'

import { cn } from '../../lib/cn'
import { type Locale, useUiStore } from '../../store/ui'

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'ko', label: 'KO' },
  { value: 'en', label: 'EN' },
]

export function LanguageSwitcher() {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const setLocale = useUiStore((s) => s.setLocale)

  return (
    <div role="group" aria-label={t('lang.label')} className="flex rounded-lg border border-border p-0.5">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          lang={value}
          aria-pressed={locale === value}
          onClick={() => setLocale(value)}
          className={cn(
            'h-10 min-w-10 rounded-md px-2 text-xs font-semibold transition-colors',
            'focus-visible:outline-2 focus-visible:outline-accent',
            locale === value ? 'bg-accent text-accent-fg' : 'text-muted hover:text-text',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
