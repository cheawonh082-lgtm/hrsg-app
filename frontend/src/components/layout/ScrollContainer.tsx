import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

/** 넓은 표·도식을 자기 영역 안에서만 가로 스크롤 (R-1). 좌우 그림자로 스크롤 가능 여부 표시. */
export function ScrollContainer({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn('scroll-shadow-x overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-accent', className)}
    >
      {children}
    </div>
  )
}
