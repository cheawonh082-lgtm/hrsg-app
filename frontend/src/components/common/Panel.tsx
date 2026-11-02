import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

/** 제목이 있는 카드 영역. aside: 제목 오른쪽 보조 정보(기준 시각 등) */
export function Panel({
  title,
  aside,
  className,
  children,
}: {
  title: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('card min-w-0 p-4 md:p-5', className)}>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="min-w-0 flex-1 font-bold">{title}</h2>
        {aside && <div className="text-xs text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />
}
