import { Copy, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useEmailPreview } from '../../api/hooks/useChecklist'
import type { EmailExportRequest } from '../../api/types'
import { copyText } from '../../lib/clipboard'
import { cn } from '../../lib/cn'
import { useToastStore } from '../../store/toast'
import { useUiStore } from '../../store/ui'
import { Modal } from '../layout/Modal'

type Scope = EmailExportRequest['scope']
type Recipient = NonNullable<EmailExportRequest['recipientAlias']>

const SCOPES: Scope[] = ['unchecked', 'all', 'required_only']
const RECIPIENTS: Recipient[] = ['customer_contact', 'plant_operations', 'performance_engineer']

interface Props {
  open: boolean
  onClose: () => void
  /** 체크 상태가 바뀌면 미리보기를 다시 받도록 하는 값 */
  statesVersion: string
}

/**
 * 데이터 요청 이메일 텍스트 (PRD §3.3). 본문은 서버가 만든다(포맷 규칙·실명 마스킹 한 곳).
 * 수신자는 정해진 별칭 중에서만 고른다 — 실명·고객사명 입력란 없음(PRD §5).
 */
export function EmailExportDialog({ open, onClose, statesVersion }: Props) {
  const { t } = useTranslation()
  const uiLocale = useUiStore((s) => s.locale)
  const [scope, setScope] = useState<Scope>('unchecked')
  const [locale, setLocale] = useState(uiLocale)
  const [includeMemo, setIncludeMemo] = useState(false)
  const [recipient, setRecipient] = useState<Recipient>('customer_contact')
  const [selectedHint, setSelectedHint] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const showToast = useToastStore((s) => s.show)
  const ids = { scope: useId(), locale: useId(), recipient: useId(), memo: useId(), preview: useId() }

  const preview = useEmailPreview({ scope, locale, includeMemo, recipientAlias: recipient }, statesVersion, open)
  const text = preview.data ? `${t('checklist.email.subjectLabel', { lng: locale })}: ${preview.data.subject}\n\n${preview.data.body}` : ''

  const copy = async () => {
    const result = await copyText(text, textRef.current)
    setSelectedHint(result === 'selected')
    if (result === 'copied') showToast(t('checklist.email.copied', { count: preview.data?.itemCount ?? 0 }))
    else if (result === 'failed') showToast(t('checklist.email.copyFailed'), 'error')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('checklist.email.title')}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {selectedHint && (
            <p role="status" className="text-sm text-muted sm:mr-auto">
              {t('checklist.email.selectedHint')}
            </p>
          )}
          <button
            type="button"
            onClick={() => void copy()}
            disabled={!preview.data}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <Copy aria-hidden className="size-4" />
            {t('checklist.email.copy')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend id={ids.scope} className="text-sm font-medium">
            {t('checklist.email.scope')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => setScope(s)}
                className={cn(
                  'min-h-11 rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent',
                  scope === s ? 'border-accent bg-accent text-accent-fg' : 'border-border hover:bg-surface-2',
                )}
              >
                {t(`checklist.email.scopes.${s}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={ids.locale} className="mb-1 block text-sm font-medium">
              {t('checklist.email.language')}
            </label>
            <select
              id={ids.locale}
              value={locale}
              onChange={(e) => setLocale(e.target.value as typeof locale)}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor={ids.recipient} className="mb-1 block text-sm font-medium">
              {t('checklist.email.recipient')}
            </label>
            <select
              id={ids.recipient}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value as Recipient)}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
            >
              {RECIPIENTS.map((r) => (
                <option key={r} value={r}>
                  {t(`checklist.email.recipients.${r}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input
            id={ids.memo}
            type="checkbox"
            checked={includeMemo}
            onChange={(e) => setIncludeMemo(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-[var(--accent)]"
          />
          <label htmlFor={ids.memo} className="min-w-0 text-sm">
            <span className="font-medium">{t('checklist.email.includeMemo')}</span>
            <span className="block text-muted">{t('checklist.email.memoHint')}</span>
          </label>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-sm text-muted">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{t('checklist.email.privacy')}</span>
        </p>

        <div className="space-y-1">
          <label htmlFor={ids.preview} className="flex items-center gap-2 text-sm font-medium">
            {t('checklist.email.preview')}
            {preview.data && (
              <span className="text-muted">· {t('checklist.email.itemCount', { count: preview.data.itemCount })}</span>
            )}
            {preview.isFetching && <LoaderCircle aria-hidden className="size-4 animate-spin text-muted motion-reduce:animate-none" />}
          </label>
          <textarea
            id={ids.preview}
            ref={textRef}
            data-testid="email-preview"
            readOnly
            value={preview.isError ? t('checklist.email.previewError') : text}
            rows={14}
            className="w-full resize-y rounded-lg border border-border bg-surface-2 p-3 font-mono text-base leading-relaxed md:text-sm"
          />
        </div>
      </div>
    </Modal>
  )
}
