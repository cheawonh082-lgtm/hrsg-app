import { CircleCheck, CircleHelp, OctagonAlert, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { StatusLevel } from '../../api/types'
import { cn } from '../../lib/cn'

type PillStatus = StatusLevel | 'insufficient_data'

const STYLE: Record<PillStatus, { icon: typeof CircleCheck; className: string; labelKey: string }> = {
  normal: {
    icon: CircleCheck,
    className: 'text-status-normal border-status-normal/40 bg-status-normal/10',
    labelKey: 'status.normal',
  },
  caution: {
    icon: TriangleAlert,
    className: 'text-status-caution border-status-caution/40 bg-status-caution/10',
    labelKey: 'status.caution',
  },
  danger: {
    icon: OctagonAlert,
    className: 'text-status-danger border-status-danger/40 bg-status-danger/10',
    labelKey: 'status.danger',
  },
  insufficient_data: {
    icon: CircleHelp,
    className: 'text-muted border-border bg-surface-2',
    labelKey: 'status.insufficient_data',
  },
}

/** 상태는 색 + 아이콘 + 텍스트를 함께 표시 (색각 접근성, PRD §3.0) */
export function StatusPill({
  status,
  size = 'md',
  className,
}: {
  status: PillStatus
  size?: 'sm' | 'md'
  className?: string
}) {
  const { t } = useTranslation()
  const { icon: Icon, className: tone, labelKey } = STYLE[status]

  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        tone,
        className,
      )}
    >
      <Icon aria-hidden className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      {t(labelKey)}
    </span>
  )
}
