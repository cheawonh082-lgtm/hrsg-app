import { type FormEvent, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { useUpdateReference } from '../../api/hooks/useAdmin'
import type { ReferenceDoc, ReferenceIssue, ReferencePatch } from '../../api/types'
import { useToastStore } from '../../store/toast'
import { Modal } from '../layout/Modal'
import { IssueList } from './IssueList'
import { btnPrimary, btnSecondary, inputClass, labelClass } from './ui'

interface Form {
  title: string
  authors: string // 한 줄에 한 명
  year: string
  venue: string
  doi: string
  url: string
  lang: 'ko' | 'en'
}

function toForm(d: ReferenceDoc): Form {
  return {
    title: d.title,
    authors: d.authors.join('\n'),
    year: d.year == null ? '' : String(d.year),
    venue: d.venue,
    doi: d.doi,
    url: d.url,
    lang: d.lang === 'en' ? 'en' : 'ko',
  }
}

/** 바뀐 필드만 보낸다 */
function diff(d: ReferenceDoc, f: Form): ReferencePatch {
  const patch: ReferencePatch = {}
  const authors = f.authors.split('\n').map((a) => a.trim()).filter(Boolean)
  const year = f.year.trim() ? Number(f.year) : null
  if (f.title.trim() !== d.title) patch.title = f.title
  if (authors.join('\n') !== d.authors.join('\n')) patch.authors = authors
  if (year !== d.year) patch.year = year
  if (f.venue.trim() !== d.venue) patch.venue = f.venue
  if (f.doi.trim() !== d.doi) patch.doi = f.doi
  if (f.url.trim() !== d.url) patch.url = f.url
  if (f.lang !== d.lang) patch.lang = f.lang
  return patch
}

export function ReferenceEditDialog({
  doc,
  issues,
  onClose,
}: {
  doc: ReferenceDoc | null
  issues: ReferenceIssue[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const update = useUpdateReference()
  const showToast = useToastStore((s) => s.show)
  const [form, setForm] = useState<Form | null>(null)
  const formId = useId()
  const ids = { title: useId(), authors: useId(), year: useId(), venue: useId(), doi: useId(), url: useId(), lang: useId() }

  useEffect(() => {
    setForm(doc ? toForm(doc) : null)
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 다른 문헌을 열 때만 초기화
  }, [doc?.docId])

  if (!doc || !form) return null
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const patch = diff(doc, form)
  const changed = Object.keys(patch).length > 0
  const yearInvalid = !!form.year.trim() && !/^\d{4}$/.test(form.year.trim())
  const titleInvalid = !form.title.trim()

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!changed || yearInvalid || titleInvalid) return
    update.mutate(
      { docId: doc.docId, patch },
      {
        onSuccess: (res) => {
          showToast(t(`admin.refs.saved.${res.ragSync}`), res.ragSync === 'reloaded' ? 'success' : 'info')
          onClose()
        },
      },
    )
  }

  const error = update.error instanceof ApiError ? t(update.error.messageKey, { defaultValue: t('admin.errors.generic') }) : null

  return (
    <Modal
      open
      onClose={onClose}
      title={t('admin.refs.editTitle', { id: doc.docId })}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {error && (
            <p role="alert" className="mr-auto text-sm text-status-danger">
              {error}
            </p>
          )}
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('admin.refs.cancel')}
          </button>
          <button type="submit" form={formId} disabled={!changed || yearInvalid || titleInvalid || update.isPending} className={btnPrimary}>
            {t('admin.refs.save')}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-surface-2 p-3 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-muted">{t('admin.fields.sourceFile')}</dt>
            <dd className="truncate font-medium" title={doc.sourceFile}>
              {doc.sourceFile || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t('admin.fields.paragraphs')}</dt>
            <dd className="font-medium tabular-nums">
              {doc.paragraphCount}
              {doc.pages && <span className="text-muted"> · p. {doc.pages}</span>}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted">{t('admin.fields.license')}</dt>
            <dd className="truncate font-medium" title={doc.license}>
              {doc.sourceType || '—'}
            </dd>
          </div>
        </dl>

        {issues.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <IssueList issues={issues} />
          </div>
        )}

        <div>
          <label htmlFor={ids.title} className={labelClass}>
            {t('admin.fields.title')}
          </label>
          <textarea
            id={ids.title}
            rows={2}
            value={form.title}
            onChange={set('title')}
            aria-invalid={titleInvalid}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted">{t('admin.refs.titleHint')}</p>
        </div>
        <div>
          <label htmlFor={ids.authors} className={labelClass}>
            {t('admin.fields.authors')}
          </label>
          <textarea id={ids.authors} rows={3} value={form.authors} onChange={set('authors')} className={inputClass} />
          <p className="mt-1 text-xs text-muted">{t('admin.refs.authorsHint')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr_7rem]">
          <div>
            <label htmlFor={ids.year} className={labelClass}>
              {t('admin.fields.year')}
            </label>
            <input
              id={ids.year}
              inputMode="numeric"
              value={form.year}
              onChange={set('year')}
              aria-invalid={yearInvalid}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={ids.venue} className={labelClass}>
              {t('admin.fields.venue')}
            </label>
            <input id={ids.venue} value={form.venue} onChange={set('venue')} className={inputClass} />
          </div>
          <div>
            <label htmlFor={ids.lang} className={labelClass}>
              {t('admin.fields.lang')}
            </label>
            <select id={ids.lang} value={form.lang} onChange={set('lang')} className={inputClass}>
              <option value="ko">ko</option>
              <option value="en">en</option>
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={ids.doi} className={labelClass}>
              {t('admin.fields.doi')}
            </label>
            <input id={ids.doi} value={form.doi} onChange={set('doi')} placeholder="10.xxxx/..." className={inputClass} />
          </div>
          <div>
            <label htmlFor={ids.url} className={labelClass}>
              {t('admin.fields.url')}
            </label>
            <input id={ids.url} type="url" value={form.url} onChange={set('url')} placeholder="https://" className={inputClass} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
