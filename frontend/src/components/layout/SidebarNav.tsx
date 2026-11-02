import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { NAV_ITEMS, type NavItem } from './navItems'

interface Props {
  /** 내비게이션 랜드마크 이름 — PC 사이드바와 모바일 드로어가 서로 다른 이름을 쓴다 */
  label: string
  /** dark: PC 남색 사이드바 / light: 모바일 드로어(표면색 배경) */
  variant: 'dark' | 'light'
  /** 링크를 누른 뒤 호출 (드로어 닫기) */
  onNavigate?: () => void
}

/** 세로 메뉴 (레퍼런스 대시보드 좌측 메뉴). 하위 메뉴가 있는 항목은 펼치기 버튼이 따로 있다. */
export function SidebarNav({ label, variant, onNavigate }: Props) {
  return (
    <nav aria-label={label}>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavEntry key={item.to} item={item} variant={variant} onNavigate={onNavigate} />
        ))}
      </ul>
    </nav>
  )
}

function NavEntry({ item, variant, onNavigate }: { item: NavItem; variant: Props['variant']; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { pathname, search } = useLocation()
  const groupId = useId()
  const inSection = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
  const [open, setOpen] = useState(inSection)
  const dark = variant === 'dark'
  const { icon: Icon, children } = item

  // 다른 화면에서 이 메뉴로 들어오면 하위 메뉴를 펼친다
  useEffect(() => {
    if (inSection) setOpen(true)
  }, [inSection])

  // 하위 메뉴가 있는 항목은 하위 메뉴가 강조를 맡고, 상위 행은 글자만 밝힌다
  const rowClass = (active: boolean) =>
    cn(
      'flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
      'focus-visible:outline-2 focus-visible:outline-accent',
      active && !children
        ? 'bg-accent text-white shadow-sm'
        : active
          ? dark
            ? 'font-semibold text-white'
            : 'font-semibold text-accent'
          : dark
          ? 'text-sidebar-fg hover:bg-white/5 hover:text-white'
          : 'text-text hover:bg-surface-2',
    )

  return (
    <li>
      <div className="flex items-center gap-1">
        <NavLink to={item.to} end={item.to === '/'} onClick={onNavigate} className={({ isActive }) => rowClass(isActive)}>
          <Icon aria-hidden className="size-5 shrink-0" />
          <span className="min-w-0 truncate">{t(item.labelKey)}</span>
        </NavLink>
        {children && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={groupId}
            aria-label={t('nav.toggleGroup', { label: t(item.labelKey) })}
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-accent',
              dark ? 'text-sidebar-muted hover:bg-white/5 hover:text-white' : 'text-muted hover:bg-surface-2',
            )}
          >
            <ChevronDown aria-hidden className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>

      {children && (
        <ul id={groupId} hidden={!open} className="mt-1 space-y-0.5 pl-3">
          {children.map((child) => {
            const active = inSection && child.match(new URLSearchParams(search))
            return (
              <li key={child.to}>
                <Link
                  to={child.to}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-start gap-2 rounded-xl px-3 py-2 text-[13px] leading-snug transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-accent',
                    active
                      ? dark
                        ? 'bg-sidebar-2 font-semibold text-white'
                        : 'bg-tone-blue-bg font-semibold text-accent'
                      : dark
                        ? 'text-sidebar-muted hover:bg-white/5 hover:text-white'
                        : 'text-muted hover:bg-surface-2 hover:text-text',
                  )}
                >
                  <span className="min-w-0">{t(child.labelKey)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
