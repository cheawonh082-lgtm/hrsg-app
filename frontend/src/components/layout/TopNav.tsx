import { Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { LanguageSwitcher } from '../common/LanguageSwitcher'
import { ThemeToggle } from '../common/ThemeToggle'
import { NAV_ITEMS } from './navItems'

/**
 * 상단 헤더. lg 이상에서는 메뉴 포함 TopNav, 미만에서는 로고 + 언어·테마만 있는 축약 헤더
 * (메뉴는 BottomTabBar가 담당, PRD §3.0).
 */
export function TopNav() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center gap-3 px-4 lg:h-16 lg:px-8">
      <Link
        to="/calculator"
        aria-label={t('app.home')}
        className="flex min-w-0 shrink items-center gap-2 rounded-lg font-semibold focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Flame aria-hidden className="size-6 shrink-0 text-accent" />
        <span className="truncate">{t('app.name')}</span>
      </Link>

      <nav aria-label={t('nav.main')} className="ml-6 hidden min-w-0 lg:flex">
        <ul className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-accent',
                    isActive ? 'bg-surface-2 text-accent' : 'text-muted hover:bg-surface-2 hover:text-text',
                  )
                }
              >
                <Icon aria-hidden className="size-4" />
                {t(labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </div>
  )
}
