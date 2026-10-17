import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChecklistItem as ItemData, ChecklistItemPatch, ChecklistItemState } from '../../api/types'
import { sectionCheckState } from '../../lib/checklist'
import { cn } from '../../lib/cn'
import { ChecklistItem } from './ChecklistItem'
import { Bar } from './ProgressBar'

interface Props {
  id: ItemData['category']
  label: string
  items: ItemData[]
  states: Map<string, ChecklistItemState>
  progress: { total: number; checked: number }
  open: boolean
  onToggle: () => void
  highlighted?: boolean
  highlightedItems?: Set<string>
  onChange: (itemId: string, patch: ChecklistItemPatch) => void
  onCheckAll: (checked: boolean) => void
}

/** 카테고리 섹션 (PRD §3.3): 접기/펼치기, 섹션 전체 체크, 카테고리 진행률 */
export function ChecklistSection({
  id,
  label,
  items,
  states,
  progress,
  open,
  onToggle,
  highlighted,
  highlightedItems,
  onChange,
  onCheckAll,
}: Props) {
  const { t } = useTranslation()
  const panelId = useId()
  const allRef = useRef<HTMLInputElement>(null)
  const stateList = items.map((i) => states.get(i.id)!).filter(Boolean)
  const check = sectionCheckState(items, stateList)

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = check === 'some'
  }, [check])

  return (
    <section
      id={`cat-${id}`}
      data-testid={`section-${id}`}
      data-highlighted={highlighted || undefined}
      aria-label={label}
      className={cn(
        'scroll-mt-40 rounded-xl border bg-surface transition-colors',
        highlighted ? 'border-accent ring-2 ring-accent/40' : 'border-border',
      )}
    >
      <div className="flex items-center gap-1 px-2">
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            ref={allRef}
            type="checkbox"
            checked={check === 'all'}
            onChange={(e) => onCheckAll(e.target.checked)}
            disabled={items.length === 0}
            className="size-5 accent-[var(--accent)]"
          />
          <span className="sr-only">{t('checklist.section.checkAll', { section: label })}</span>
        </label>
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="flex min-h-14 w-full items-center gap-3 py-2 pr-2 text-left focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{label}</span>
            <span className="shrink-0 text-sm text-muted tabular-nums">
              {progress.checked}/{progress.total}
            </span>
            <Bar value={progress.checked} max={progress.total} label={label} className="hidden w-20 sm:block" />
            <ChevronDown aria-hidden className={cn('size-5 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
          </button>
        </h2>
      </div>
      <ul id={panelId} hidden={!open} className="space-y-1 border-t border-border px-2 py-2">
        {items.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            state={states.get(item.id) ?? { itemId: item.id, checked: false, status: 'pending' }}
            highlighted={highlightedItems?.has(item.id)}
            onChange={(patch) => onChange(item.id, patch)}
          />
        ))}
      </ul>
    </section>
  )
}
