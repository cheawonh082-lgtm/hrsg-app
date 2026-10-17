import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '../../lib/cn'

/** MOCK 데이터 경고. sm 이상은 전체 문구, 모바일은 한 줄 축약 + 탭하면 전체 문구 (PRD §3.0). */
export function MockBanner() {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <div role="status" className="border-t border-border bg-mock-bg text-mock-fg">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-2 px-4 text-sm font-medium lg:px-8">
        {/* 모바일: 행 전체가 버튼 (터치 영역 44px, R-9) */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? t('mock.collapse') : t('mock.expand')}
          className="flex min-h-11 w-full min-w-0 items-center gap-2 py-2 text-left sm:hidden"
        >
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">{expanded ? t('mock.full') : t('mock.short')}</span>
          <ChevronDown aria-hidden className={cn('size-4 shrink-0 transition-transform', expanded && 'rotate-180')} />
        </button>

        <p className="hidden min-w-0 items-center gap-2 py-1.5 sm:flex">
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0">{t('mock.full')}</span>
        </p>
      </div>
    </div>
  )
}
