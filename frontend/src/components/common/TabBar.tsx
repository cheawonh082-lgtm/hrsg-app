import { type KeyboardEvent, type ReactNode, useRef } from 'react'

import { cn } from '../../lib/cn'

export interface TabDef<T extends string> {
  id: T
  /** 화면에 보이는 내용 (좁은 화면에서 일부를 숨겨도 ariaLabel로 전체 이름을 전달) */
  content: ReactNode
  ariaLabel?: string
}

interface Props<T extends string> {
  label: string
  tabs: TabDef<T>[]
  value: T
  onChange: (id: T) => void
  /** 탭 패널 id (aria-controls) */
  panelId: string
}

/**
 * 알약 모양 탭 (레퍼런스 계산기·체크리스트 상단 탭). 넘치면 자기 영역 안에서 가로 스크롤(R-1).
 * 좌우 화살표·Home·End로 탭 이동 (WAI-ARIA tabs).
 */
export function TabBar<T extends string>({ label, tabs, value, onChange, panelId }: Props<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (e: KeyboardEvent) => {
    const i = tabs.findIndex((tab) => tab.id === value)
    const next =
      e.key === 'ArrowRight' ? (i + 1) % tabs.length
      : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
      : -1
    if (next < 0) return
    e.preventDefault()
    onChange(tabs[next].id)
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      data-scroll-container
      onKeyDown={onKeyDown}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0"
    >
      {tabs.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            aria-label={tab.ariaLabel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              selected
                ? 'border-accent bg-accent text-white shadow-sm'
                : 'border-border bg-surface text-muted hover:border-accent/50 hover:text-text',
            )}
          >
            {tab.content}
          </button>
        )
      })}
    </div>
  )
}
