import { Copy, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useEmailPreview } from '../../api/hooks/useChecklist'
import type { EmailExportRequest } from '../../api/types'
import { copyText } from '../../lib/clipboard'
import { cn } from '../../lib/cn'
import { useToastStore } from '../../store/toast'
import { Modal } from '../layout/Modal'

type Scope = NonNullable<EmailExportRequest['scope']>

const SCOPES: Scope[] = ['unchecked', 'all', 'required_only']

interface Props {
  open: boolean
  onClose: () => void
  /** 체크 상태가 바뀌면 미리보기를 다시 받도록 하는 값 */
  statesVersion: string
}

/**
 * 데이터 요청 이메일 텍스트. 본문은 서버가 키트 emailDraft()로 만든다(실명 마스킹 포함).
 * 「미완료 항목」 = 키트 기본(아직 받지 않은 항목 전부). 메일은 보내지 않고 복사만 한다.
 */
export function EmailExportDialog({ open, onClose, statesVersion }: Props) {
  const { t } = useTranslation()
  const [scope, setScope] = useState<Scope>('unchecked')
  const [selectedHint, setSelectedHint] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const showToast = useToastStore((s) => s.show)
  const ids = { scope: useId(), preview: useId() }

  // 메일 문구는 키트 emailDraft() 그대로 (키트에 한국어 문구만 있다)
  const preview = useEmailPreview({ scope }, statesVersion, open)
  const text = preview.data?.body ?? ''

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
