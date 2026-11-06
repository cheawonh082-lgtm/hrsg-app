import { ClipboardList } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import type { PinchApproachEvaluation } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { useUiStore } from '../../store/ui'
import { StatusPill } from '../common/StatusPill'

/**
 * 「데이터 필요」 → 체크리스트를 키트가 준 분류(checklist_category, 'B')로 열고,
 * 그 섹션의 키트 입력(sections.HP …)에 쓰이는 항목을 강조한다.
 */
export const checklistFocusUrl = (p: Pick<PinchApproachEvaluation, 'section' | 'checklistCategory'>) =>
  `/checklist?focus=${encodeURIComponent(p.checklistCategory)}&inputs=sections.${p.section}`

/** HP/IP/LP 핀치·어프로치 평가 (키트 pinch_section). 입력이 없으면 "데이터 필요" + 체크리스트 해당 분류로 이동(강조) */
export function PinchApproachPanel({ items }: { items: PinchApproachEvaluation[] }) {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const c = (v: number | null | undefined) =>
    v == null ? '–' : `${formatNumber(v, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}℃`

  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {items.map((p) => {
        const insufficient = p.status === 'insufficient_data'
        return (
          <li
            key={p.section}
            data-testid={`pinch-${p.section}`}
            data-status={p.status}
            className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{t('calc.pinch.section', { section: p.section })}</h3>
              <StatusPill status={p.status} size="sm" />
            </div>

            <dl className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm tabular-nums">
              <span />
              <dt className="text-right text-muted">{t('calc.pinch.current')}</dt>
              <dt className="text-right text-muted">{t('calc.pinch.design')}</dt>
              <dt className="text-muted">{t('calc.pinch.pinch')}</dt>
              <dd className="text-right font-medium">{c(p.pinchC)}</dd>
              <dd className="text-right">{c(p.designPinchC)}</dd>
              <dt className="text-muted">{t('calc.pinch.approach')}</dt>
              <dd className="text-right font-medium">{c(p.approachC)}</dd>
              <dd className="text-right">{c(p.designApproachC)}</dd>
            </dl>

            {/* 키트 문구 그대로 */}
            <p className="text-sm text-muted">{p.message}</p>

            {insufficient && (
              <Link
                to={checklistFocusUrl(p)}
                className="mt-auto inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-border px-3 text-sm font-medium text-accent hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <ClipboardList aria-hidden className="size-4" />
                {t('calc.pinch.requestData')}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
