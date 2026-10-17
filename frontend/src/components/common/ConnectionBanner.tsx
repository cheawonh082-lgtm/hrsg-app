import { WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function ConnectionBanner() {
  const { t } = useTranslation()

  return (
    <div role="alert" className="border-t border-border bg-surface-2 text-status-danger">
      <p className="mx-auto flex max-w-screen-2xl items-center gap-2 px-4 py-2 text-sm font-medium lg:px-8">
        <WifiOff aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0">{t('connection.offline')}</span>
      </p>
    </div>
  )
}
