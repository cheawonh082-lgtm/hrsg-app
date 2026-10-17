import { ChevronDown } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

import { cn } from '../../lib/cn'

interface AccordionProps {
  title: string
  defaultOpen?: boolean
  /** 접혀 있어도 보이는 표시 (예: 오류 개수) */
  badge?: ReactNode
  children: ReactNode
}

/** 접힌 상태에서도 내용은 유지(hidden)되어 입력 중인 값이 사라지지 않는다. */
export function Accordion({ title, defaultOpen = false, badge, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className="border-t border-border">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full items-center gap-2 py-2 text-left font-medium focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="min-w-0 flex-1">{title}</span>
          {badge}
          <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="pb-4">
        {children}
      </div>
    </div>
  )
}
