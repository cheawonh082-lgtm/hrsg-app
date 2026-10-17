import { Info, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { NoticeBlock as NoticeData } from '../../api/types'
import { cn } from '../../lib/cn'

/** 안내·거절 메시지 (PRD §3.2 거절 응답). 문구는 서버가 준 messageKey로 i18n에서 찾는다. */
export function NoticeBlock({ notice }: { notice: NoticeData }) {
  const { t } = useTranslation()
  const Icon = notice.level === 'warning' ? ShieldAlert : Info
  return (
    <p
      data-testid="notice"
      data-key={notice.messageKey}
      className={cn(
        'flex items-start gap-2 rounded-lg border p-3 text-sm',
        notice.level === 'warning'
          ? 'border-status-caution/40 bg-status-caution/10'
          : 'border-border bg-surface-2 text-muted',
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">{t(notice.messageKey, { defaultValue: t('chat.notice.generic') })}</span>
    </p>
  )
}
