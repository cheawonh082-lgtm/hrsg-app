import { Calculator, ClipboardList, MessageSquare, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  icon: LucideIcon
  labelKey: string
  /** 좁은 화면(하단 탭바)용 짧은 라벨 (R-11) */
  shortLabelKey: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/calculator', icon: Calculator, labelKey: 'nav.calculator', shortLabelKey: 'nav.calculator' },
  { to: '/chat', icon: MessageSquare, labelKey: 'nav.chat', shortLabelKey: 'nav.chat' },
  { to: '/checklist', icon: ClipboardList, labelKey: 'nav.checklist', shortLabelKey: 'nav.checklistShort' },
]
