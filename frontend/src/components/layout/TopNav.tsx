import { Menu, Wind } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { LanguageSwitcher } from '../common/LanguageSwitcher'
import { ThemeToggle } from '../common/ThemeToggle'

/** 로고 + 앱 이름. dark: 남색 사이드바 위 */
export function Brand({ dark, onClick }: { dark?: boolean; onClick?: () => void }) {
  const { t } = useTranslation()
  return (
    <Link
      to="/"
      onClick={onClick}
      aria-label={t('app.home')}
      className={cn(
        'flex min-w-0 shrink items-center gap-2.5 rounded-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-accent',
        dark ? 'text-white' : 'text-text',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-sm">
        <Wind aria-hidden className="size-4.5" strokeWidth={2.4} />
      </span>
      <span className="truncate">{t('app.name')}</span>
    </Link>
  )
}

/**
 * 상단 바. lg 이상: 메뉴는 좌측 사이드바가 맡고 언어·테마만 오른쪽에.
 * lg 미만: 로고 + 언어·테마 + 전체 메뉴(드로어) 버튼 — 주요 화면 이동은 하단 탭바 (PRD §3.0).
 */
export function TopNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex h-14 w-full items-center gap-2 px-4 lg:h-16 lg:px-8">
      <div className="min-w-0 lg:hidden">
        <Brand />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={t('nav.openMenu')}
          aria-haspopup="dialog"
          className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
        >
          <Menu aria-hidden className="size-6" />
        </button>
      </div>
    </div>
  )
}
