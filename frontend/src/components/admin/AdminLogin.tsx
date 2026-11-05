import { LockKeyhole } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAdminLogin, useAdminSession } from '../../api/hooks/useAdmin'
import { ApiError } from '../../api/client'
import { btnPrimary, inputClass, labelClass } from './ui'

export function AdminLogin() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const login = useAdminLogin()
  const expired = useAdminSession((s) => s.expired)
  const inputId = useId()
  const errorId = useId()

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (password) login.mutate(password, { onSuccess: () => setPassword('') })
  }

  const error = login.error instanceof ApiError ? t(login.error.messageKey, { defaultValue: t('admin.errors.generic') }) : null

  return (
    <form onSubmit={onSubmit} data-testid="admin-login" className="card mx-auto w-full max-w-sm space-y-4 p-5">
      <div className="flex items-center gap-2">
        <LockKeyhole aria-hidden className="size-5 text-accent" />
        <h2 className="font-bold">{t('admin.login.title')}</h2>
      </div>
      {expired && !error && <p className="text-sm text-muted">{t('admin.login.expired')}</p>}
      <div>
        <label htmlFor={inputId} className={labelClass}>
          {t('admin.login.password')}
        </label>
        <input
          id={inputId}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={inputClass}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-status-danger">
            {error}
          </p>
        )}
      </div>
      <button type="submit" disabled={!password || login.isPending} className={`${btnPrimary} w-full`}>
        {t('admin.login.submit')}
      </button>
    </form>
  )
}
