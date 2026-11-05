import { LogOut, ShieldOff } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useQueryClient } from '@tanstack/react-query'

import { useAdminConfig, useAdminSession } from '../api/hooks/useAdmin'
import { AdminLogin } from '../components/admin/AdminLogin'
import { ReferencesPanel } from '../components/admin/ReferencesPanel'
import { SystemStatusPanel } from '../components/admin/SystemStatusPanel'
import { btnSecondary } from '../components/admin/ui'
import { Panel, Skeleton } from '../components/common/Panel'
import { TabBar } from '../components/common/TabBar'

type Tab = 'references' | 'status'

/** 관리자 모드 (/admin) — 1차: 로그인, 참고문헌 데이터베이스 관리, 시스템 상태 */
export function AdminPage() {
  const { t } = useTranslation()
  const config = useAdminConfig()
  const session = useAdminSession((s) => s.session)
  const logout = useAdminSession((s) => s.logout)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('references')
  const panelId = useId()

  const onLogout = () => {
    logout()
    queryClient.removeQueries({ queryKey: ['admin', 'references'] })
    queryClient.removeQueries({ queryKey: ['admin', 'status'] })
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('admin.title')}</h1>
          <p className="text-muted">{t('admin.subtitle')}</p>
        </div>
        {session && (
          <button type="button" onClick={onLogout} className={btnSecondary}>
            <LogOut aria-hidden className="size-4" />
            {t('admin.logout')}
          </button>
        )}
      </header>

      {config.isPending ? (
        <Skeleton className="h-48" />
      ) : config.isError ? (
        <Panel title={t('admin.title')}>
          <p role="alert" className="text-status-danger">
            {t('admin.errors.loadFailed')}
          </p>
        </Panel>
      ) : !config.data.enabled ? (
        <Panel title={t('admin.disabled.title')}>
          <div className="flex items-start gap-3 text-sm">
            <ShieldOff aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
            <p className="text-muted">{t('admin.disabled.hint')}</p>
          </div>
        </Panel>
      ) : !session ? (
        <AdminLogin />
      ) : (
        <>
          <TabBar
            label={t('admin.tabsLabel')}
            tabs={[
              { id: 'references', content: t('admin.tabs.references') },
              { id: 'status', content: t('admin.tabs.status') },
            ]}
            value={tab}
            onChange={setTab}
            panelId={panelId}
          />
          <div id={panelId} role="tabpanel">
            {tab === 'references' ? <ReferencesPanel /> : <SystemStatusPanel />}
          </div>
        </>
      )}
    </section>
  )
}
