import { type KeyboardEvent, type ReactNode, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { CalcResult, Metric, StatusLevel } from '../../api/types'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { cn } from '../../lib/cn'
import { withAlpha } from '../../lib/echarts'
import { formatNumber } from '../../lib/format'
import { BUNDLES } from '../../lib/performance'
import { useUiStore } from '../../store/ui'
import { useThemeColors } from '../../theme/useThemeColors'
import { StatusPill } from '../common/StatusPill'

/** 튜브 배열 4×4 (viewBox 100 기준) */
const GRID = 4
const PITCH = 100 / GRID
const TUBE_R = 10

type PartId = 'gt' | (typeof BUNDLES)[number] | 'stack'
/** 툴팁을 부품의 어느 쪽에 맞출지 — 도식 양 끝에서 화면 밖으로 잘리지 않게 */
type Align = 'start' | 'center' | 'end'

/**
 * HRSG 간략 도식 — GT → 과열기·증발기·절탄기 → 굴뚝.
 * 튜브 링 두께는 키트 r.display_fouling(0~1, 표시용·손실 계산과 무관), 색은 HRSG 차압 판정(굴뚝은 스택 온도 판정)을 따른다.
 * 부품에 마우스를 올리거나 누르면(탭) 표시 오염도와 관련 운전 지표를 보여 준다.
 */
export function HrsgSchematic({ result }: { result: CalcResult }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const colors = useThemeColors()
  const { isMobile, atLeast } = useBreakpoint()
  const row = atLeast('md')
  const fmt = (v: number) => formatNumber(v, locale, { maximumFractionDigits: 0 })

  const [selected, setSelected] = useState<PartId | null>(null)
  const [hovered, setHovered] = useState<PartId | null>(null)
  const shown = hovered ?? selected

  const fouling = result.displayFouling
  // 깨끗해도 얇은 링은 보이게, 표시 오염도 1이면 반지름의 약 60%
  const ring = (x: number) => 1.5 + x * 4.5
  const pct = (x: number) => `${fmt(x * 100)}%`
  const metric = (key: string) => result.current.metrics.find((m) => m.key === key)
  const stackMetric = metric('stackTemp')
  const gtMetric = metric('gtBackPressure')
  const dpMetric = metric('hrsgGasDp')
  const bundleStatus: StatusLevel = dpMetric?.status ?? 'normal'
  const stackStatus: StatusLevel = stackMetric?.status ?? 'normal'
  const tone = (s: StatusLevel) => colors[s]

  const hotspot = (id: PartId, align: Align, detail: ReactNode, children: ReactNode, className?: string) => (
    <Hotspot
      id={id}
      align={align}
      open={shown === id}
      pressed={selected === id}
      detail={detail}
      className={className}
      onToggle={() => setSelected((cur) => (cur === id ? null : id))}
      onHover={(on) => (on ? !isMobile && setHovered(id) : setHovered(null))}
      onFocus={(on) => setHovered(on ? id : null)}
    >
      {children}
    </Hotspot>
  )

  return (
    <figure data-testid="hrsg-schematic" className="space-y-4">
      <div className="flex flex-col items-stretch md:flex-row md:items-center">
        {hotspot(
          'gt',
          row ? 'start' : 'center',
          <PartDetail title={t('calc.schematic.gt')} status={gtMetric?.status}>
            <MetricLine metric={gtMetric} fmt={fmt} />
            <Line label={t('calc.schematic.exhaustTemp')} value={`${fmt(result.input.condition.exhaustTempC)}℃`} />
          </PartDetail>,
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-2 px-3 py-4 md:w-28 md:py-8">
            <span className="font-semibold">{t('calc.schematic.gt')}</span>
            <span className="text-sm text-muted tabular-nums">{fmt(result.input.condition.gtLoadPct)}%</span>
          </div>,
        )}
        <Connector />

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-muted">{t('calc.schematic.flow')} →</p>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border p-2 sm:gap-4 sm:p-4">
            {BUNDLES.map((b, i) => {
              const status = bundleStatus
              const c = tone(status)
              const x = fouling[b]
              return (
                <div key={b} data-bundle={b} data-status={status} data-fouling={x.toFixed(3)} className="min-w-0">
                  {hotspot(
                    b,
                    // 모바일은 3열이 화면 폭을 채우므로 양 끝 열은 바깥쪽 끝에 맞춘다
                    row ? 'center' : i === 0 ? 'start' : i === BUNDLES.length - 1 ? 'end' : 'center',
                    <PartDetail title={t(`calc.schematic.${b}`)} status={status}>
                      <Line label={t('calc.schematic.displayFouling', { value: pct(x) })} value="" />
                      <MetricLine metric={dpMetric} fmt={fmt} />
                    </PartDetail>,
                    <div className="flex flex-col items-center gap-2">
                      <svg aria-hidden viewBox="-4 -4 108 108" className="w-full max-w-28">
                        <rect x={-2} y={-2} width={104} height={104} rx={6} fill={colors.surface} stroke={c} strokeWidth={shown === b ? 4 : 2.5} />
                        {Array.from({ length: GRID * GRID }, (_, k) => (
                          <circle
                            key={k}
                            cx={PITCH * ((k % GRID) + 0.5)}
                            cy={PITCH * (Math.floor(k / GRID) + 0.5)}
                            r={TUBE_R - ring(x) / 2}
                            fill={withAlpha(colors.muted, 0.08)}
                            stroke={c}
                            strokeOpacity={0.85}
                            strokeWidth={ring(x)}
                          />
                        ))}
                      </svg>
                      <span className="text-center text-sm">{t(`calc.schematic.${b}`)}</span>
                    </div>,
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <Connector />
        {hotspot(
          'stack',
          row ? 'end' : 'center',
          <PartDetail title={t('calc.schematic.stack')} status={stackStatus}>
            <MetricLine metric={stackMetric} fmt={fmt} />
          </PartDetail>,
          <div className="flex flex-col items-center gap-1 md:pt-5">
            <div data-testid="schematic-stack" data-status={stackStatus} className="relative h-32 w-24">
              <svg aria-hidden viewBox="0 0 96 128" className="absolute inset-0 size-full">
                <path
                  d="M24,2 L72,2 L94,26 L94,126 L2,126 L2,26 Z"
                  fill={withAlpha(colors.muted, 0.08)}
                  stroke={tone(stackStatus)}
                  strokeWidth={shown === 'stack' ? 4 : 2.5}
                  strokeLinejoin="round"
                />
              </svg>
              <div className="relative flex size-full flex-col items-center justify-center pt-5">
                <span className="font-semibold tabular-nums">{fmt(result.input.condition.stackTempC)}℃</span>
                {stackMetric?.baseline != null && (
                  <span className="text-xs text-muted tabular-nums">
                    {t('calc.schematic.design', { value: fmt(stackMetric.baseline) })}
                  </span>
                )}
              </div>
            </div>
            <span className="text-sm">{t('calc.schematic.stack')}</span>
          </div>,
          'self-center',
        )}
      </div>

      <figcaption className="space-y-1 text-sm text-muted">
        <p>
          {t('calc.schematic.foulingIndex', { value: fmt(fouling.overall * 100) })}{' '}
          <span className="font-semibold text-text">{t('calc.schematic.displayOnly')}</span>
        </p>
        <p>{t(isMobile ? 'calc.schematic.hintTap' : 'calc.schematic.hintHover')}</p>
      </figcaption>
    </figure>
  )
}

const ALIGN: Record<Align, string> = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
}

function Hotspot({
  id,
  align,
  open,
  pressed,
  detail,
  className,
  children,
  onToggle,
  onHover,
  onFocus,
}: {
  id: PartId
  align: Align
  open: boolean
  pressed: boolean
  detail: ReactNode
  className?: string
  children: ReactNode
  onToggle: () => void
  onHover: (on: boolean) => void
  onFocus: (on: boolean) => void
}) {
  const tipId = useId()
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={pressed}
      aria-describedby={open ? tipId : undefined}
      data-part={id}
      onClick={onToggle}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onFocus(true)}
      onBlur={() => onFocus(false)}
      className={cn(
        'relative cursor-pointer rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        open && 'z-20',
        className,
      )}
    >
      {children}
      {open && (
        <div
          id={tipId}
          role="tooltip"
          data-testid="schematic-tooltip"
          className={cn(
            'pointer-events-none absolute top-full mt-2 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-3 text-left shadow-lg',
            ALIGN[align],
          )}
        >
          {detail}
        </div>
      )}
    </div>
  )
}

function PartDetail({ title, status, children }: { title: string; status?: StatusLevel | null; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{title}</span>
        {status && <StatusPill status={status} size="sm" />}
      </div>
      <ul className="space-y-1.5 text-sm">{children}</ul>
    </div>
  )
}

function Line({ label, value, status }: { label: ReactNode; value: string; status?: StatusLevel | null }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="min-w-0 text-muted">{label}</span>
      <span className="flex shrink-0 items-center gap-2 tabular-nums">
        {value}
        {status && <StatusPill status={status} size="sm" />}
      </span>
    </li>
  )
}

function MetricLine({ metric, fmt }: { metric?: Metric; fmt: (v: number) => string }) {
  const { t } = useTranslation()
  if (!metric) return null
  const design = metric.baseline != null ? ` (${t('calc.schematic.design', { value: fmt(metric.baseline) })})` : ''
  return <Line label={t(`calc.metrics.${metric.key}`)} value={`${fmt(metric.value)} ${metric.unit}${design}`} status={metric.status} />
}

function Connector() {
  return <span aria-hidden className="h-4 w-1 self-center bg-border md:h-1 md:w-6" />
}
