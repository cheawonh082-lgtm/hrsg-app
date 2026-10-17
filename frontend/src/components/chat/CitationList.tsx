import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Citation } from '../../api/types'

/** 근거 목록 (PRD §3.2). 문서 별칭 + 섹션 + 마스킹된 발췌만 — 원문 열기·다운로드 기능은 두지 않는다(PRD §5). */
export function CitationList({ items, mockDocs }: { items: Citation[]; mockDocs?: boolean }) {
  const { t } = useTranslation()
  return (
    <section data-testid="citations" aria-label={t('chat.citations.title')} className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {t('chat.citations.title')}
        {mockDocs && (
          <span className="rounded-md bg-mock-bg px-1.5 py-0.5 text-xs font-bold text-mock-fg">
            {t('chat.citations.mock')}
          </span>
        )}
      </h3>
      <ul className="space-y-2">
        {items.map((c, i) => (
          <li key={`${c.docAlias}-${i}`} className="rounded-lg border border-border bg-surface p-3 text-sm">
            <p className="flex min-w-0 items-center gap-1.5 font-medium">
              <FileText aria-hidden className="size-4 shrink-0 text-muted" />
              <span className="shrink-0">{c.docAlias}</span>
              {c.sectionTitle && <span className="min-w-0 truncate text-muted">· {c.sectionTitle}</span>}
            </p>
            <p className="mt-1 line-clamp-3 text-muted">{c.snippet}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
