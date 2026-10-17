import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

import { useHealth } from '../../api/hooks/useHealth'
import { useApplyLocale } from '../../i18n/useApplyLocale'
import { useApplyTheme } from '../../theme/useApplyTheme'
import { ConnectionBanner } from '../common/ConnectionBanner'
import { MockBanner } from '../common/MockBanner'
import { BottomTabBar } from './BottomTabBar'
import { TopNav } from './TopNav'

/**
 * 앱 공통 틀 (PRD §3.0, §3.4.4).
 * - 상단: TopNav(lg+) / 축약 헤더(lg 미만) + MOCK·연결 상태 배너 (sticky)
 * - 하단: BottomTabBar(lg 미만, fixed) — 본문은 탭바 높이 + safe-area 만큼 아래 여백 확보
 */
export function AppShell() {
  useApplyTheme()
  useApplyLocale()
  const { t } = useTranslation()
  const health = useHealth()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-accent px-4 py-2 text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('a11y.skipToContent')}
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <TopNav />
        {health.data?.isMock && <MockBanner />}
        {health.isError && <ConnectionBanner />}
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-screen-2xl min-w-0 flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-6 lg:pb-10"
      >
        <Outlet />
      </main>

      <BottomTabBar />
    </div>
  )
}
