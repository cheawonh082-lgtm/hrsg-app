import { Calculator, ClipboardCheck, House, MessageSquareText, type LucideIcon } from 'lucide-react'

/** 계산기 화면의 탭 (?tab=) — 사이드바 하위 메뉴와 계산기 탭이 같은 목록을 쓴다 */
export const CALC_TABS = [
  { id: 'loss', labelKey: 'calc.tabs.loss' },
  { id: 'cleaning', labelKey: 'calc.tabs.cleaning' },
  { id: 'pinch', labelKey: 'calc.tabs.pinch' },
] as const

export type CalcTab = (typeof CALC_TABS)[number]['id']

export function parseCalcTab(value: string | null): CalcTab {
  return CALC_TABS.find((tab) => tab.id === value)?.id ?? 'loss'
}

export interface NavChild {
  to: string
  labelKey: string
  /** 현재 위치(search 포함)가 이 하위 메뉴인지 */
  match: (search: URLSearchParams) => boolean
}

export interface NavItem {
  to: string
  icon: LucideIcon
  labelKey: string
  /** 좁은 화면(하단 탭바)용 짧은 라벨 (R-11) */
  shortLabelKey: string
  /** 사이드바에서 펼치는 하위 메뉴 */
  children?: NavChild[]
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: House, labelKey: 'nav.home', shortLabelKey: 'nav.home' },
  { to: '/chat', icon: MessageSquareText, labelKey: 'nav.chat', shortLabelKey: 'nav.chatShort' },
  {
    to: '/calculator',
    icon: Calculator,
    labelKey: 'nav.calculator',
    shortLabelKey: 'nav.calculator',
    children: CALC_TABS.map(({ id, labelKey }) => ({
      to: `/calculator?tab=${id}`,
      labelKey,
      match: (search) => parseCalcTab(search.get('tab')) === id,
    })),
  },
  { to: '/checklist', icon: ClipboardCheck, labelKey: 'nav.checklistShort', shortLabelKey: 'nav.checklistShort' },
]
