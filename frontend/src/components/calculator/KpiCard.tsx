import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { StatusLevel } from '../../api/types'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'
import { cn } from '../../lib/cn'
import { StatusPill } from '../common/StatusPill'

export interface KpiCardProps {
  label: string
  value: number | null | undefined
  format: (value: number) => string
  unit?: string
  /** 축약 표기 시 전체 값 (탭/hover로 확인, R-5) */
  fullValue?: string
  /** 기준 대비 차이 (기준 = deltaLabel이 설명) */
  delta?: number | null
  deltaFormat?: (absDelta: number) => string
  deltaLabel?: string
  /** true면 증가(▲)가 나쁨(위험색), 감소(▼)가 좋음 */
  higherIsWorse?: boolean
  status?: StatusLevel
  sub?: ReactNode
  loading?: boolean
  testId?: string
}

const EPSILON = 1e-9

export function KpiCard({
  label,
  value,
  format,
  unit,
  fullValue,
  delta,
  deltaFormat = (d) => String(d),
  deltaLabel,
  higherIsWorse = true,
  status,
  sub,
  loading,
  testId,
}: KpiCardProps) {
  const { t } = useTranslation()
  const animated = useAnimatedNumber(value)
  const finalText = value == null ? '–' : format(value)
  const shownText = animated == null ? '–' : format(animated)

  const hasDelta = delta != null && Math.abs(delta) > EPSILON
  const up = hasDelta && delta > 0
  const bad = hasDelta && up === higherIsWorse

  return (
    <div
      data-testid={testId}
      aria-busy={loading}
      className="@container flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 text-sm text-muted">{label}</span>
        {loading && <LoaderCircle aria-hidden className="size-3.5 shrink-0 animate-spin text-muted" />}
      </div>

      <div className="flex min-w-0 items-baseline gap-1" title={fullValue}>
        {/* 화면에는 애니메이션 값, 보조기기에는 최종 값만 전달.
            글자 크기는 카드 폭 기준(container query) — 좁은 카드에서도 "28.8억 원"이 줄바꿈되지 않게 (R-5) */}
        <span
          aria-hidden
          data-testid={testId && `${testId}-value`}
          className="min-w-0 text-[clamp(1.25rem,15cqi,2.25rem)] leading-tight font-semibold whitespace-nowrap tabular-nums"
        >
          {shownText}
        </span>
        <span className="sr-only">{finalText}</span>
        {unit && <span className="shrink-0 text-sm text-muted">{unit}</span>}
      </div>

      {hasDelta && (
        <p className={cn('text-sm font-medium tabular-nums', bad ? 'text-status-danger' : 'text-status-normal')}>
          <span aria-hidden>{up ? '▲' : '▼'} </span>
          <span className="sr-only">{t(up ? 'calc.kpi.increase' : 'calc.kpi.decrease')} </span>
          {deltaFormat(Math.abs(delta))}
          {deltaLabel && <span className="font-normal text-muted"> · {deltaLabel}</span>}
        </p>
      )}
      {status && <StatusPill status={status} className="self-start" />}
      {sub && <div className="text-sm text-muted">{sub}</div>}
    </div>
  )
}
