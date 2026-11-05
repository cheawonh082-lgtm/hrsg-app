import { Leaf, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { useHealth } from '../../api/hooks/useHealth'
import { useResizeObserver } from '../../hooks/useResizeObserver'
import { useApplyLocale } from '../../i18n/useApplyLocale'
import { useApplyTheme } from '../../theme/useApplyTheme'
import { ConnectionBanner } from '../common/ConnectionBanner'
import { MockBanner } from '../common/MockBanner'
import { Toaster } from '../common/Toaster'
import { BottomTabBar } from './BottomTabBar'
import { Drawer } from './Drawer'
import { SidebarNav } from './SidebarNav'
import { Brand, TopNav } from './TopNav'

/**
 * 앱 공통 틀 (PRD §3.0, §3.4.4) — 레퍼런스 대시보드 배치.
 * - lg 이상: 좌측 고정 남색 사이드바(w-64) + 오른쪽 본문(상단 바 + MOCK·연결 배너 sticky)
 * - lg 미만: 상단 바(로고·언어·테마·메뉴) + 하단 탭바(fixed) + 전체 메뉴 드로어
 * - 헤더 높이(배너 유무·접힘에 따라 변함)를 --app-header-h로 내보내 페이지의 sticky 요소가 헤더 바로 아래에 붙게 한다
 */
export function AppShell() {
  useApplyTheme()
  useApplyLocale()
  const { t } = useTranslation()
  const health = useHealth()
  const headerRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  const publishHeaderHeight = useCallback(() => {
    const h = headerRef.current?.getBoundingClientRect().height
    if (h) document.documentElement.style.setProperty('--app-header-h', `${Math.round(h)}px`)
  }, [])
  useEffect(publishHeaderHeight, [publishHeaderHeight, health.data?.isMock, health.isError])
  useResizeObserver(headerRef, publishHeaderHeight, 0)

  // 화면을 옮기면 드로어를 닫는다
  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <div className="min-h-dvh lg:pl-64">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-accent px-4 py-2 text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('a11y.skipToContent')}
      </a>

      <aside
        data-testid="sidebar"
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar pt-[env(safe-area-inset-top)] text-sidebar-fg lg:flex"
      >
        <div className="flex h-16 shrink-0 items-center px-5">
          <Brand dark />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          <SidebarNav label={t('nav.main')} variant="dark" />
        </div>
        {/* 관리자 모드 — 주 메뉴와 분리해 작게 */}
        <Link
          to="/admin"
          data-testid="admin-link"
          className="mx-4 mt-2 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-fg/70 hover:bg-sidebar-2 hover:text-sidebar-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ShieldCheck aria-hidden className="size-4" />
          {t('admin.nav')}
        </Link>
        <p className="m-4 flex items-start gap-2.5 rounded-2xl bg-sidebar-2 p-4 text-xs leading-relaxed text-sidebar-fg">
          <Leaf aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-400" />
          <span className="min-w-0">{t('app.tagline')}</span>
        </p>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header ref={headerRef} className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <TopNav onOpenMenu={() => setMenuOpen(true)} />
          {health.data?.isMock && <MockBanner />}
          {health.isError && <ConnectionBanner />}
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-screen-2xl min-w-0 flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-6 lg:pb-10"
        >
          <Outlet />
        </main>
      </div>

      <BottomTabBar />
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title={t('nav.menu')}>
        <SidebarNav label={t('nav.all')} variant="light" onNavigate={() => setMenuOpen(false)} />
      </Drawer>
      <Toaster />
    </div>
  )
}
