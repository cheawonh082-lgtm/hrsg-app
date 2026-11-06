import { ArrowRight, Calculator, ClipboardCheck, MessageSquareText, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useChecklist } from '../api/hooks/useChecklist'
import { KpiRow } from '../components/calculator/KpiRow'
import { TrendChart } from '../components/calculator/TrendChart'
import { Panel, Skeleton } from '../components/common/Panel'
import { CleaningCostDonut } from '../components/home/CleaningCostDonut'
import { HeroIllustration } from '../components/home/HeroIllustration'
import { useCalculatorDraft } from '../hooks/useCalculatorDraft'
import { cn } from '../lib/cn'
import { formatNumber } from '../lib/format'
import { useChatStore } from '../store/chat'
import { useUiStore } from '../store/ui'

type Tone = 'blue' | 'green' | 'purple'

const TONE: Record<Tone, { card: string; icon: string; arrow: string }> = {
  blue: { card: 'bg-tone-blue-bg', icon: 'bg-tone-blue', arrow: 'bg-tone-blue' },
  green: { card: 'bg-tone-green-bg', icon: 'bg-tone-green', arrow: 'bg-tone-green' },
  purple: { card: 'bg-tone-purple-bg', icon: 'bg-tone-purple', arrow: 'bg-tone-purple' },
}

const FEATURES: { to: string; icon: LucideIcon; titleKey: string; descKey: string; tone: Tone }[] = [
  { to: '/chat', icon: MessageSquareText, titleKey: 'nav.chat', descKey: 'home.cards.chat', tone: 'blue' },
  { to: '/calculator', icon: Calculator, titleKey: 'nav.calculator', descKey: 'home.cards.calculator', tone: 'green' },
  { to: '/checklist', icon: ClipboardCheck, titleKey: 'nav.checklistShort', descKey: 'home.cards.checklist', tone: 'purple' },
]

/**
 * 홈 대시보드 (레퍼런스 UI). 수치는 모두 실제 화면 데이터에서 온다:
 * 계산기 현재 입력의 계산 결과(KPI·감도·세정 공법 비용), 체크리스트 진행률, 챗 대화 수.
 */
export function HomePage() {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const { calc } = useCalculatorDraft()
  const checklist = useChecklist(locale)
  const questionCount = useChatStore((s) => s.messages.filter((m) => m.role === 'user').length)
  const result = calc.result
  const computedAt =
    result &&
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
      new Date(result.meta.computedAt),
    )
  const progress = checklist.data?.progress

  return (
    <section className="space-y-6 pb-4">
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6">
        <header className="flex flex-col justify-center space-y-1 py-1">
          <p className="text-lg text-muted">{t('home.greeting')}</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('home.title')}</h1>
          <p className="pt-1 text-sm text-muted md:text-base">{t('home.subtitle')}</p>
        </header>

        <div className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-sky-100 via-blue-100 to-blue-300 p-5 text-slate-900 shadow-[var(--shadow-card)] md:p-6 dark:from-sky-950 dark:via-blue-950 dark:to-blue-800 dark:text-white">
          <HeroIllustration className="absolute right-0 bottom-0 -z-10 h-full max-h-40 w-auto opacity-90 dark:opacity-40" />
          <p className="max-w-[60%] text-lg leading-snug font-bold whitespace-pre-line md:text-xl">{t('home.hero.title')}</p>
          <p className="mt-2 max-w-[60%] text-xs text-slate-700 md:text-sm dark:text-blue-100">{t('home.hero.subtitle')}</p>
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-3 md:gap-4">
        {FEATURES.map(({ to, icon: Icon, titleKey, descKey, tone }) => (
          <li key={to} className="min-w-0">
            <Link
              to={to}
              aria-label={t('home.cards.open', { label: t(titleKey) })}
              className={cn(
                'group flex h-full min-w-0 flex-col items-center gap-2 rounded-2xl p-3 text-center transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:gap-4 sm:p-5 sm:text-left',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                TONE[tone].card,
              )}
            >
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-surface shadow-sm sm:size-12', TONE[tone].icon)}>
                <Icon aria-hidden className="size-5 sm:size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold sm:text-base">{t(titleKey)}</span>
                <span className="mt-1 hidden text-sm whitespace-pre-line text-muted sm:block">{t(descKey)}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'hidden size-7 shrink-0 items-center justify-center self-end rounded-full text-surface transition-transform group-hover:translate-x-0.5 sm:flex',
                  TONE[tone].arrow,
                )}
              >
                <ArrowRight className="size-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title={t('home.kpi.title')} aside={computedAt && `${computedAt} · ${t('home.kpi.basis')}`}>
          <KpiRow result={result} pending={calc.isPending} locale={locale} className="grid grid-cols-2 gap-3 2xl:grid-cols-4" />
          <h3 className="mt-6 mb-2 font-bold">{t('home.trend.title')}</h3>
          {result ? (
            <TrendChart series={result.sensitivity} currentY={result.loss.totalPowerLossMw} />
          ) : (
            <Skeleton className="h-[220px] md:h-[260px]" />
          )}
        </Panel>

        <div className="grid content-start gap-6 md:grid-cols-2 xl:grid-cols-1">
          <Panel title={t('home.cleaning.title')}>
            {result ? <CleaningCostDonut rows={result.cleaningComparison} /> : <Skeleton className="h-40" />}
          </Panel>

          <Panel title={t('home.activity.title')}>
            <ul className="divide-y divide-border">
              <Activity to="/chat" icon={MessageSquareText} tone="blue">
                {questionCount ? t('home.activity.chat', { count: questionCount }) : t('home.activity.chatNone')}
              </Activity>
              <Activity to="/calculator" icon={Calculator} tone="green">
                {result
                  ? t('home.activity.calc', {
                      status: t(`status.${result.current.overallStatus}`),
                      index: formatNumber(Math.round(result.current.foulingIndex), locale),
                    })
                  : t('home.activity.loading')}
              </Activity>
              <Activity to="/checklist" icon={ClipboardCheck} tone="purple">
                {progress
                  ? t('home.activity.checklist', { checked: progress.checked, total: progress.total, percent: progress.percent })
                  : t('home.activity.loading')}
              </Activity>
            </ul>
          </Panel>
        </div>
      </div>
    </section>
  )
}

function Activity({ to, icon: Icon, tone, children }: { to: string; icon: LucideIcon; tone: Tone; children: ReactNode }) {
  const TEXT: Record<Tone, string> = { blue: 'text-tone-blue', green: 'text-tone-green', purple: 'text-tone-purple' }
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-14 items-center gap-3 rounded-lg py-2.5 text-sm hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', TONE[tone].card, TEXT[tone])}>
          <Icon aria-hidden className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">{children}</span>
        <ArrowRight aria-hidden className="size-4 shrink-0 text-muted" />
      </Link>
    </li>
  )
}
