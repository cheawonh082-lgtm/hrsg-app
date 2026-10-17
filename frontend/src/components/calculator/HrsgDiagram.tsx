import { type KeyboardEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SectionHealth, SectionId, StatusLevel } from '../../api/types'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { withAlpha } from '../../lib/echarts'
import { formatNumber } from '../../lib/format'
import { clamp } from '../../lib/thresholds'
import { useUiStore } from '../../store/ui'
import { type ThemeColors, useThemeColors } from '../../theme/useThemeColors'
import { StatusPill } from '../common/StatusPill'

/** 가스 흐름 순서 (GT 출구 → 스택, PRD §1.2) */
const TUBE_SECTIONS: SectionId[] = [
  'HP_SH', 'RH', 'HP_EVA', 'HP_ECO', 'IP_SH', 'IP_EVA', 'IP_ECO', 'LP_SH', 'LP_EVA', 'CPH',
]
/** 색 + 기호 + 텍스트로 상태 표시 (색각 접근성) */
const GLYPH: Record<StatusLevel, string> = { normal: '✓', caution: '!', danger: '✕' }

const H = { width: 930, height: 232, boxY: 50, boxH: 130, boxW: 66, gap: 6, startX: 130, stackX: 860 }
const V = { width: 340, rowH: 44, rowGap: 8, startY: 66, x: 40, w: 290 }

const statusColor = (colors: ThemeColors, s: StatusLevel) => colors[s]
const temp = (v: number | null | undefined, locale: 'ko' | 'en') =>
  v == null ? '–' : `${formatNumber(v, locale, { maximumFractionDigits: 0 })}℃`

/**
 * HRSG 구조도 (인라인 SVG). PC·태블릿은 가로 흐름, 모바일은 세로 흐름 (PRD §3.4.2, R-7).
 * 섹션에 마우스를 올리거나 누르면(탭) 가스 입·출구 온도와 상태를 표시한다.
 */
export function HrsgDiagram({ sections }: { sections: SectionHealth[] }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const colors = useThemeColors()
  const { isMobile } = useBreakpoint()
  const markerId = `flow-${useId().replace(/:/g, '')}`

  const [selected, setSelected] = useState<SectionId | null>(null)
  const [hovered, setHovered] = useState<SectionId | null>(null)
  const shownId = hovered ?? selected
  const byId = new Map(sections.map((s) => [s.sectionId, s]))
  const shown = shownId ? byId.get(shownId) : undefined
  const orientation = isMobile ? 'vertical' : 'horizontal'

  const name = (id: SectionId) => t(`calc.sections.${id}.name`)
  const short = (id: SectionId) => t(`calc.sections.${id}.short`)

  /** 섹션 공통 상호작용·접근성 속성 */
  const interactive = (s: SectionHealth) => ({
    role: 'button',
    tabIndex: 0,
    'aria-pressed': selected === s.sectionId,
    'aria-label': `${name(s.sectionId)} (${short(s.sectionId)}): ${t(`status.${s.status}`)}, ${t('calc.diagram.gasIn')} ${temp(s.gasInTempC, locale)}, ${t('calc.diagram.gasOut')} ${temp(s.gasOutTempC, locale)}`,
    'data-section': s.sectionId,
    'data-status': s.status,
    className: 'cursor-pointer outline-none [&:focus-visible>rect]:stroke-[4]',
    onClick: () => setSelected((cur) => (cur === s.sectionId ? null : s.sectionId)),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setSelected((cur) => (cur === s.sectionId ? null : s.sectionId))
      }
    },
    onMouseEnter: () => !isMobile && setHovered(s.sectionId),
    onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered(s.sectionId),
    onBlur: () => setHovered(null),
  })

  const boxStyle = (s: SectionHealth, active: boolean) => ({
    fill: withAlpha(statusColor(colors, s.status), active ? 0.32 : 0.16),
    stroke: statusColor(colors, s.status),
    strokeWidth: active ? 3.5 : 2,
  })

  const gtTemp = sections[0]?.gasInTempC
  const stack = byId.get('STACK')

  const horizontal = (
    <svg viewBox={`0 0 ${H.width} ${H.height}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={colors.accent} />
        </marker>
      </defs>
      {/* GT + 덕트 */}
      <rect x={8} y={60} width={86} height={110} rx={8} fill={colors.surface} stroke={colors.border} strokeWidth={2} />
      <text x={51} y={110} textAnchor="middle" fontSize={18} fontWeight={700} fill={colors.text}>GT</text>
      <text x={51} y={136} textAnchor="middle" fontSize={13} fill={colors.muted}>{temp(gtTemp, locale)}</text>
      <path d="M94,82 L126,52 L126,178 L94,148 Z" fill={withAlpha(colors.border, 0.6)} />

      {TUBE_SECTIONS.map((id, i) => {
        const s = byId.get(id)
        if (!s) return null
        const x = H.startX + i * (H.boxW + H.gap)
        const cx = x + H.boxW / 2
        return (
          <g key={id} {...interactive(s)}>
            <rect x={x} y={H.boxY} width={H.boxW} height={H.boxH} rx={6} {...boxStyle(s, shownId === id)} />
            <text x={cx} y={H.boxY + 26} textAnchor="middle" fontSize={16} fontWeight={700} fill={statusColor(colors, s.status)}>
              {GLYPH[s.status]}
            </text>
            <text x={cx} y={H.boxY + 70} textAnchor="middle" fontSize={15} fontWeight={600} fill={colors.text}>
              {short(id)}
            </text>
            <text x={cx} y={H.boxY + 115} textAnchor="middle" fontSize={13} fill={colors.muted}>
              {temp(s.gasOutTempC, locale)}
            </text>
          </g>
        )
      })}

      {stack && (
        <g {...interactive(stack)}>
          <rect x={H.stackX} y={10} width={52} height={170} rx={4} {...boxStyle(stack, shownId === 'STACK')} />
          <text x={H.stackX + 26} y={36} textAnchor="middle" fontSize={16} fontWeight={700} fill={statusColor(colors, stack.status)}>
            {GLYPH[stack.status]}
          </text>
          <text x={H.stackX + 26} y={100} textAnchor="middle" fontSize={13} fontWeight={600} fill={colors.text}>
            {short('STACK')}
          </text>
          <text x={H.stackX + 26} y={165} textAnchor="middle" fontSize={13} fill={colors.muted}>
            {temp(stack.gasOutTempC, locale)}
          </text>
        </g>
      )}

      <line x1={20} y1={205} x2={905} y2={205} stroke={colors.accent} strokeWidth={2} strokeDasharray="8 6" className="hrsg-flow" markerEnd={`url(#${markerId})`} />
      <text x={20} y={226} fontSize={13} fill={colors.muted}>{t('calc.diagram.flow')} →</text>
    </svg>
  )

  const vHeight = V.startY + (TUBE_SECTIONS.length + 1) * (V.rowH + V.rowGap) + 4
  const vertical = (
    <svg viewBox={`0 0 ${V.width} ${vHeight}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={colors.accent} />
        </marker>
      </defs>
      <line x1={18} y1={12} x2={18} y2={vHeight - 8} stroke={colors.accent} strokeWidth={2} strokeDasharray="8 6" className="hrsg-flow" markerEnd={`url(#${markerId})`} />
      <rect x={V.x} y={10} width={V.w} height={V.rowH} rx={8} fill={colors.surface} stroke={colors.border} strokeWidth={2} />
      <text x={V.x + 16} y={37} fontSize={14} fontWeight={700} fill={colors.text}>{t('calc.diagram.gt')}</text>
      <text x={V.x + V.w - 14} y={37} textAnchor="end" fontSize={13} fill={colors.muted}>{temp(gtTemp, locale)}</text>

      {[...TUBE_SECTIONS, 'STACK' as const].map((id, i) => {
        const s = byId.get(id)
        if (!s) return null
        const y = V.startY + i * (V.rowH + V.rowGap)
        return (
          <g key={id} {...interactive(s)}>
            <rect x={V.x} y={y} width={V.w} height={V.rowH} rx={6} {...boxStyle(s, shownId === id)} />
            <text x={V.x + 16} y={y + 28} fontSize={15} fontWeight={700} fill={statusColor(colors, s.status)}>
              {GLYPH[s.status]}
            </text>
            <text x={V.x + 36} y={y + 28} fontSize={14} fill={colors.text}>
              {name(id)} <tspan fill={colors.muted} fontSize={12}>({short(id)})</tspan>
            </text>
            <text x={V.x + V.w - 14} y={y + 28} textAnchor="end" fontSize={13} fill={colors.muted}>
              {temp(s.gasOutTempC, locale)}
            </text>
          </g>
        )
      })}
    </svg>
  )

  // 가로 도식: 섹션 위치 기준 툴팁 / 세로 도식: 아래 정보 패널
  const tooltipLeft = (() => {
    if (!shownId) return 50
    const i = TUBE_SECTIONS.indexOf(shownId)
    const cx = i >= 0 ? H.startX + i * (H.boxW + H.gap) + H.boxW / 2 : H.stackX + 26
    return clamp((cx / H.width) * 100, 14, 86)
  })()

  const info = shown && (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {name(shown.sectionId)} <span className="font-normal text-muted">({short(shown.sectionId)})</span>
        </span>
        <StatusPill status={shown.status} size="sm" />
      </div>
      <p className="text-sm tabular-nums">
        {t('calc.diagram.gasIn')} {temp(shown.gasInTempC, locale)} → {t('calc.diagram.gasOut')} {temp(shown.gasOutTempC, locale)}
      </p>
    </div>
  )

  return (
    <figure data-testid="hrsg-diagram" data-orientation={orientation} className="space-y-3">
      <div className="relative">
        {orientation === 'horizontal' ? horizontal : vertical}
        {orientation === 'horizontal' && info && (
          <div
            role="tooltip"
            data-testid="hrsg-tooltip"
            style={{ left: `${tooltipLeft}%` }}
            className="pointer-events-none absolute top-[78%] z-10 w-max max-w-[min(18rem,90%)] -translate-x-1/2 rounded-lg border border-border bg-surface p-3 shadow-lg"
          >
            {info}
          </div>
        )}
      </div>

      {orientation === 'vertical' && (
        <div data-testid="hrsg-info" aria-live="polite" className="min-h-16 rounded-lg border border-border bg-surface-2 p-3">
          {info ?? <p className="text-sm text-muted">{t('calc.diagram.hintTap')}</p>}
        </div>
      )}

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span>{orientation === 'horizontal' ? t('calc.diagram.hintHover') : t('calc.diagram.legend')}</span>
        <span className="flex flex-wrap gap-2">
          {(['normal', 'caution', 'danger'] as const).map((s) => (
            <StatusPill key={s} status={s} size="sm" />
          ))}
        </span>
      </figcaption>
    </figure>
  )
}
