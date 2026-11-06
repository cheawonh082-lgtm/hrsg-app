import { LoaderCircle, MessageSquare, SlidersHorizontal } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { ApiError } from '../api/client'
import { useCalcResult } from '../api/hooks/useCalc'
import type { CalcResult } from '../api/types'
import { CleaningCostTable } from '../components/calculator/CleaningCostTable'
import { GaugeGroup } from '../components/calculator/GaugeChart'
import { HrsgSchematic } from '../components/calculator/HrsgSchematic'
import { InputPanel, type InputPanelProps } from '../components/calculator/InputPanel'
import { KpiRow } from '../components/calculator/KpiRow'
import { LossComparison } from '../components/calculator/LossComparison'
import { PerformanceKpiGrid } from '../components/calculator/PerformanceKpiGrid'
import { PinchApproachPanel } from '../components/calculator/PinchApproachPanel'
import { RecoveryEffect } from '../components/calculator/RecoveryEffect'
import { TrendChart } from '../components/calculator/TrendChart'
import { Accordion } from '../components/common/Accordion'
import { Panel, Skeleton } from '../components/common/Panel'
import { StatusPill } from '../components/common/StatusPill'
import { TabBar } from '../components/common/TabBar'
import { BottomSheet } from '../components/layout/BottomSheet'
import { CALC_TABS, type CalcTab, parseCalcTab } from '../components/layout/navItems'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useCalculatorDraft } from '../hooks/useCalculatorDraft'
import { usePreviousDistinct } from '../hooks/usePreviousDistinct'
import { toDraft } from '../lib/calcDraft'
import { formatNumber } from '../lib/format'
import { type Locale, useUiStore } from '../store/ui'

export function CalculatorPage() {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const navigate = useNavigate()
  const { isMobile, atLeast } = useBreakpoint()
  // 좌측 메뉴(w-64)가 있어 입력 패널을 옆에 둘 폭은 xl부터 — 그보다 좁으면 상단 접이식 패널
  const sidePanel = atLeast('xl')
  const panelId = useId()

  // 화면 탭 (?tab=loss|cleaning|pinch) — 사이드바 하위 메뉴와 같은 주소
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseCalcTab(searchParams.get('tab'))
  const setTab = (next: CalcTab) =>
    setSearchParams(
      (p) => {
        p.set('tab', next)
        return p
      },
      { replace: true },
    )

  // 챗 카드 "계산기에서 열기" → /calculator?calcId= : 저장된 결과의 입력으로 복원 (A-09)
  const restoreId = searchParams.get('calcId')
  const { models, limits, draft, setDraft, calc, loadModel } = useCalculatorDraft({ skipInit: !!restoreId })
  const result = calc.result
  const previous = usePreviousDistinct(result)
  const [sheetOpen, setSheetOpen] = useState(false)
  const restored = useCalcResult(restoreId)
  const [restoreFailed, setRestoreFailed] = useState(false)
  useEffect(() => {
    if (!restoreId || restored.isPending) return
    if (restored.data) setDraft(toDraft(restored.data.input))
    setRestoreFailed(restored.isError)
    setSearchParams(
      (p) => {
        p.delete('calcId')
        return p
      },
      { replace: true },
    )
  }, [restoreId, restored.isPending, restored.data, restored.isError, setDraft, setSearchParams])

  // 모바일 → 태블릿/PC로 바뀌면 시트를 닫는다 (입력 패널이 화면에 직접 나타남)
  useEffect(() => {
    if (!isMobile) setSheetOpen(false)
  }, [isMobile])

  const panelProps: Omit<InputPanelProps, 'variant'> | null =
    draft && limits.data
      ? {
          draft,
          limits: limits.data,
          errors: calc.errors,
          models: models.data ?? [],
          isBlocked: calc.isBlocked,
          onDraftChange: setDraft,
          onModelChange: (id) => void loadModel(id, draft.economics),
          // 「초기화」 = 선택한 등급의 설계 상태 (키트 designInputs, 손실 0)
          onReset: () => void loadModel(draft.gtModelId, undefined, 'design'),
        }
      : null

  const errorCode = calc.error instanceof ApiError ? calc.error.code : calc.error?.message
  // 키트가 계산을 거부한 입력(예: 증발기 출구 가스 < 포화온도) — 키트 문구를 그대로 보여 준다
  const kitMessages =
    calc.error instanceof ApiError ? (calc.error.details as { messages?: string[] } | undefined)?.messages : undefined
  const activeTab = CALC_TABS.find((c) => c.id === tab)!

  return (
    <section className="space-y-5 pb-20 md:pb-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('calc.title')}</h1>
        <p className="text-muted">{t('calc.subtitle')}</p>
      </header>

      <div className="space-y-2">
        <TabBar
          label={t('calc.tabs.label')}
          panelId={panelId}
          value={tab}
          onChange={setTab}
          tabs={CALC_TABS.map((c) => ({
            id: c.id,
            content: t(c.labelKey),
          }))}
        />
      </div>

      <div className="xl:grid xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start xl:gap-6">
        {/* xl: 좌측 고정 입력 패널 (독립 스크롤) */}
        {sidePanel && (
          <aside
            aria-label={t('calc.input.title')}
            className="card sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain p-4"
          >
            {panelProps ? <InputPanel {...panelProps} variant="sidebar" /> : <PanelSkeleton />}
          </aside>
        )}

        <div id={panelId} role="tabpanel" aria-label={t(activeTab.labelKey)} className="min-w-0 space-y-5">
          {/* 태블릿·좁은 노트북: 상단 접이식 입력 패널(2열) */}
          {!isMobile && !sidePanel && (
            <div className="card px-4">
              <Accordion title={t('calc.input.title')} defaultOpen>
                {panelProps ? <InputPanel {...panelProps} variant="inline" /> : <PanelSkeleton />}
              </Accordion>
            </div>
          )}

          {restoreFailed && (
            <p role="alert" className="rounded-lg border border-status-caution/40 bg-status-caution/10 p-3 text-sm">
              {t('calc.restoreFailed')}
            </p>
          )}

          {calc.error && (
            <p role="alert" className="rounded-lg border border-status-danger/40 bg-status-danger/10 p-3 text-status-danger">
              {kitMessages?.length ? t('calc.inputError', { messages: kitMessages.join(' ') }) : t('calc.error', { code: errorCode })}
            </p>
          )}

          {tab === 'loss' && (
            <>
              <KpiRow result={result} previous={previous} pending={calc.isPending} locale={locale} />

              <Panel title={t('calc.gauge.title')}>
                {result ? (
                  <GaugeGroup metrics={result.current.metrics} />
                ) : (
                  <Skeleton className="h-64" />
                )}
              </Panel>

              <Panel title={t('calc.schematic.title')}>
                {result ? <HrsgSchematic result={result} /> : <Skeleton className="h-56" />}
              </Panel>

              <Panel title={t('calc.lossCompare.title')}>
                {result ? <LossComparison result={result} /> : <Skeleton className="h-24" />}
              </Panel>

              <Panel title={t('calc.recoveryEffect.title')}>
                {result ? (
                  <RecoveryEffect result={result} />
                ) : (
                  <Skeleton className="h-80" />
                )}
              </Panel>

              <Panel title={t('calc.trend.title')}>
                {result ? (
                  <TrendChart series={result.sensitivity} currentY={result.loss.totalPowerLossMw} />
                ) : (
                  <Skeleton className="h-[220px] md:h-[260px] lg:h-[300px]" />
                )}
              </Panel>
            </>
          )}

          {tab === 'cleaning' && (
            <Panel title={t('calc.cleaning.title')}>
              {result ? (
                <CleaningCostTable rows={result.cleaningComparison} />
              ) : (
                <Skeleton className="h-48" />
              )}
            </Panel>
          )}

          {tab === 'pinch' && (
            <>
              <Panel title={t('calc.pinch.title')}>
                {result ? <PinchApproachPanel items={result.pinchApproach} /> : <Skeleton className="h-40" />}
              </Panel>

              <Panel title={t('calc.perf.title')}>
                {result ? (
                  <PerformanceKpiGrid result={result} />
                ) : (
                  <Skeleton className="h-80" />
                )}
              </Panel>
            </>
          )}

          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="text-muted">{t('calc.ask.hint')}</p>
              {result && <CalcMeta result={result} />}
            </div>
            <button
              type="button"
              disabled={!result}
              onClick={() => result && navigate('/chat', { state: { calcId: result.meta.calcId } })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              <MessageSquare aria-hidden className="size-4" />
              {t('calc.ask.button')}
            </button>
          </div>
        </div>
      </div>

      {/* 모바일: 하단 고정 "입력 조정" 버튼 → 바텀시트 */}
      {isMobile && (
        <>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            disabled={!panelProps}
            aria-haspopup="dialog"
            className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-accent-fg shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <SlidersHorizontal aria-hidden className="size-5" />
            {t('calc.input.open')}
            {calc.isBlocked && <span aria-hidden className="size-2.5 rounded-full bg-status-danger ring-2 ring-accent-fg" />}
          </button>
          <BottomSheet
            open={sheetOpen && !!panelProps}
            onClose={() => setSheetOpen(false)}
            title={t('calc.input.title')}
            summary={<KpiSummary result={result} pending={calc.isPending} locale={locale} />}
          >
            {panelProps && <InputPanel {...panelProps} variant="sheet" />}
          </BottomSheet>
        </>
      )}
    </section>
  )
}

/** 바텀시트 상단 고정 요약 — 시트에서 값을 바꾸는 동안 결과 확인용 */
function KpiSummary({ result, pending, locale }: { result?: CalcResult; pending: boolean; locale: Locale }) {
  const { t } = useTranslation()
  return (
    <div data-testid="sheet-summary" aria-live="polite" className="flex min-w-0 items-center gap-2 text-sm">
      <span className="text-muted">{t('calc.kpi.totalLoss')}</span>
      <span data-testid="sheet-summary-loss" className="font-semibold tabular-nums">
        {result ? `${formatNumber(result.loss.totalPowerLossMw, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MW` : '–'}
      </span>
      {result && <StatusPill status={result.current.overallStatus} size="sm" />}
      {pending && <LoaderCircle aria-label={t('calc.input.pending')} className="ml-auto size-4 shrink-0 animate-spin text-muted" />}
    </div>
  )
}

function CalcMeta({ result }: { result: CalcResult }) {
  const { t } = useTranslation()
  const warnings = result.meta.warnings ?? []
  return (
    <>
      <p className="truncate text-xs text-muted" title={result.meta.calcId}>
        {t('calc.meta.engine')}: {result.meta.engineVersion} · ID {result.meta.calcId}
      </p>
      {warnings.map((w) => (
        <p key={w} className="text-status-caution">
          {t(w)}
        </p>
      ))}
    </>
  )
}

function PanelSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  )
}
