import { Calculator, NotebookPen } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import type { ChecklistItem as ItemData, ChecklistItemPatch, ChecklistItemState, ItemStatus } from '../../api/types'
import { applyCheck, applyStatus } from '../../lib/checklist'
import { cn } from '../../lib/cn'

const STATUSES: ItemStatus[] = ['pending', 'requested', 'received', 'na']
const MEMO_SAVE_DELAY_MS = 600

const PRIORITY_STYLE: Record<ItemData['priority'], string> = {
  required: 'border-status-caution/50 bg-status-caution/10 text-status-caution',
  recommended: 'border-accent/40 bg-accent/10 text-accent',
  optional: 'border-border bg-surface-2 text-muted',
}

interface Props {
  item: ItemData
  state: ChecklistItemState
  highlighted?: boolean
  onChange: (patch: ChecklistItemPatch) => void
}

/**
 * 체크리스트 항목 (PRD §3.3). 모바일 2줄(①체크박스+항목명 ②태그·우선순위·상태·메모), md 이상 1줄.
 * 메모는 입력이 멈추면 저장한다.
 */
export function ChecklistItem({ item, state, highlighted, onChange }: Props) {
  const { t } = useTranslation()
  const checkboxId = useId()
  const memoId = useId()
  const linkedId = useId()
  const [memoOpen, setMemoOpen] = useState(!!state.memo)
  const [memo, setMemo] = useState(state.memo ?? '')
  const [linkedOpen, setLinkedOpen] = useState(false)
  const lastSent = useRef(state.memo ?? '')
  // 부모가 다시 그려질 때마다 콜백이 바뀌어도 메모 저장 타이머가 초기화되지 않도록
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const na = state.status === 'na'

  // 서버·다른 탭에서 바뀐 메모 반영 (입력 중이 아닐 때)
  useEffect(() => {
    if ((state.memo ?? '') !== lastSent.current) {
      lastSent.current = state.memo ?? ''
      setMemo(state.memo ?? '')
    }
  }, [state.memo])

  useEffect(() => {
    if (memo === lastSent.current) return
    const timer = window.setTimeout(() => {
      lastSent.current = memo
      onChangeRef.current({ memo })
    }, MEMO_SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [memo])

  return (
    <li
      id={`item-${item.id}`}
      data-testid={`item-${item.id}`}
      data-checked={state.checked}
      data-status={state.status}
      data-highlighted={highlighted || undefined}
      className={cn(
        'scroll-mt-40 rounded-xl border border-transparent px-2 py-2 transition-colors hover:bg-surface-2/50',
        highlighted && 'border-accent bg-accent/10',
        na && 'opacity-60',
      )}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        {/* ① 체크박스 + 항목명 */}
        <div className="flex min-w-0 flex-1 items-start gap-1">
          <label htmlFor={checkboxId} className="-m-1 flex size-11 shrink-0 cursor-pointer items-center justify-center">
            <input
              id={checkboxId}
              type="checkbox"
              checked={state.checked}
              disabled={na}
              onChange={(e) => onChange(applyCheck(state, e.target.checked))}
              className="check-round"
            />
            <span className="sr-only">{item.label}</span>
          </label>
          <div className="min-w-0 flex-1 pt-2">
            <p className={cn('font-medium break-keep [overflow-wrap:anywhere]', state.checked && 'text-muted line-through decoration-1')}>
              {item.label}
            </p>
            {(item.description || item.period || item.unit) && (
              <p className="text-sm text-muted [overflow-wrap:anywhere]">
                {[item.description, item.period, item.unit && t('checklist.unit', { unit: item.unit })].filter(Boolean).join(' · ')}
              </p>
            )}
            {item.linkedCalcField && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setLinkedOpen((v) => !v)}
                  aria-expanded={linkedOpen}
                  aria-controls={linkedId}
                  title={t('checklist.linked.tooltip', { field: t(`calc.fields.${item.linkedCalcField}`) })}
                  data-testid="linked-calc"
                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-accent/40 px-2 text-xs text-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Calculator aria-hidden className="size-3.5" />
                  {t('checklist.linked.badge')}
                </button>
                {linkedOpen && (
                  <p id={linkedId} className="mt-1 text-xs text-muted">
                    {t('checklist.linked.tooltip', { field: t(`calc.fields.${item.linkedCalcField}`) })}{' '}
                    <Link to="/calculator" className="font-medium text-accent underline underline-offset-2">
                      {t('checklist.linked.open')}
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ② 구분·우선순위·상태·메모 */}
        {/* 영어 라벨처럼 길어지면 태그 줄과 [상태·메모] 묶음이 나뉘어 줄바꿈된다 — 드롭다운이 읽을 수 없게 줄지 않도록 (R-11) */}
        <div className="flex flex-wrap items-center gap-2 pl-10 md:shrink-0 md:flex-nowrap md:pl-0">
          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs whitespace-nowrap text-muted">
            {t(`checklist.kind.${item.kind}`)}
          </span>
          <span className={cn('rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap', PRIORITY_STYLE[item.priority])}>
            {t(`checklist.priority.${item.priority}`)}
          </span>
          <div className="flex min-w-[10rem] flex-1 items-center gap-2 md:min-w-0 md:flex-none">
            <select
              value={state.status}
              onChange={(e) => onChange(applyStatus(state, e.target.value as ItemStatus))}
              aria-label={t('checklist.status.label', { item: item.label })}
              className="h-11 min-w-28 flex-1 rounded-lg border border-border bg-surface px-2 text-base md:w-32 md:flex-none md:text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`checklist.status.${s}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMemoOpen((v) => !v)}
              aria-expanded={memoOpen}
              aria-controls={memoId}
              aria-label={t('checklist.memo.toggle', { item: item.label })}
              className="relative flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <NotebookPen aria-hidden className="size-5" />
              {memo && <span aria-hidden className="absolute top-2 right-2 size-2 rounded-full bg-accent" />}
            </button>
          </div>
        </div>
      </div>

      {memoOpen && (
        <div className="mt-2 pl-10">
          <label htmlFor={memoId} className="sr-only">
            {t('checklist.memo.label', { item: item.label })}
          </label>
          <textarea
            id={memoId}
            value={memo}
            maxLength={500}
            rows={2}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={t('checklist.memo.placeholder')}
            className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-base md:text-sm"
          />
        </div>
      )}
    </li>
  )
}
