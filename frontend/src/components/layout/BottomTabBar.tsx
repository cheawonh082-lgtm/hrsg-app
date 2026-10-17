import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { NAV_ITEMS } from './navItems'

/** lg 미만 하단 탭바. 홈 인디케이터 영역(safe-area)만큼 아래 여백을 둔다 (R-8). */
export function BottomTabBar() {
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-screen-md grid-cols-3">
        {NAV_ITEMS.map(({ to, icon: Icon, labelKey, shortLabelKey }) => (
          <li key={to} className="min-w-0">
            <NavLink
              to={to}
              aria-label={t(labelKey)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-medium',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                  isActive ? 'text-accent' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon aria-hidden className="size-6" strokeWidth={isActive ? 2.4 : 1.8} />
                  <span className="max-w-full truncate">{t(shortLabelKey)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
