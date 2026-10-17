import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, MessageSquare, SlidersHorizontal } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { ApiError } from '../api/client'
import { calcDefaultsQuery, useCalcResult, useGtModels, useInputLimits, useThresholds } from '../api/hooks/useCalc'
import type { CalcResult } from '../api/types'
import { CleaningCostTable } from '../components/calculator/CleaningCostTable'
import { GaugeGroup } from '../components/calculator/GaugeChart'
import { HrsgDiagram } from '../components/calculator/HrsgDiagram'
import { InputPanel, type InputPanelProps } from '../components/calculator/InputPanel'
import { KpiCard } from '../components/calculator/KpiCard'
import { PinchApproachPanel } from '../components/calculator/PinchApproachPanel'
import { TrendChart } from '../components/calculator/TrendChart'
import { Accordion } from '../components/common/Accordion'
import { StatusPill } from '../components/common/StatusPill'
import { BottomSheet } from '../components/layout/BottomSheet'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useCalculate } from '../hooks/useCalculate'
import { usePreviousDistinct } from '../hooks/usePreviousDistinct'
import { type CalcDraft, toDraft } from '../lib/calcDraft'
import { formatKrwCompact, formatKrwFull, formatNumber } from '../lib/format'
import { useCalculatorStore } from '../store/calculator'
import { type Locale, useUiStore } from '../store/ui'

export function CalculatorPage() {
  const { t } = useTranslation()
  const locale = useUiStore((s) => s.locale)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isMobile, isTablet, isDesktop } = useBreakpoint()

  const models = useGtModels()
  const limits = useInputLimits()
  const thresholds = useThresholds()
  const draft = useCalculatorStore((s) => s.draft)
  const setDraft = useCalculatorStore((s) => s.setDraft)
  const calc = useCalculate(draft, limits.data)
  const result = calc.result
  const previous = usePreviousDistinct(result)
  const [sheetOpen, setSheetOpen] = useState(false)

  // 챗 카드 "계산기에서 열기" → /calculator?calcId= : 저장된 결과의 입력으로 복원 (A-09)
  const [searchParams, setSearchParams] = useSearchParams()
  const restoreId = searchParams.get('calcId')
  const restored = useCalcResult(restoreId)
  const [restoreFailed, setRestoreFailed] = useState(false)
  useEffect(() => {
    if (!restoreId || restored.isPending) return
    if (restored.data) setDraft(toDraft(restored.data.input))
    setRestoreFailed(restored.isError)
    setSearchParams({}, { replace: true })
  }, [restoreId, restored.isPending, restored.data, restored.isError, setDraft, setSearchParams])

  /** 모델 선택 시 해당 모델의 정격 기본값으로 운전 조건을 채운다(경제성 입력은 유지) */
  const loadModel = useCallback(
    async (gtModelId: string, keepEconomics?: CalcDraft['economics']) => {
      try {
        const defaults = toDraft(await queryClient.fetchQuery(calcDefaultsQuery(gtModelId)))
        setDraft(keepEconomics ? { ...defaults, economics: keepEconomics } : defaults)
      } catch {
        // 연결 오류는 AppShell 배너가 안내한다
      }
    },
    [queryClient, setDraft],
  )

  useEffect(() => {
    if (!draft && !restoreId && models.data?.length) void loadModel(models.data[0].modelId)
  }, [draft, restoreId, models.data, loadModel])

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
          onReset: () => void loadModel(draft.gtModelId),
        }
      : null

  const errorCode = calc.error instanceof ApiError ? calc.error.code : calc.error?.message
  const dpMetric = result?.current.metrics.find((m) => m.key === 'hrsgGasDp')

  return (
    <section className="space-y-5 pb-20 md:pb-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{t('calc.title')}</h1>
        <p className="text-muted">{t('calc.subtitle')}</p>
      </header>

      <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* PC: 좌측 고정 입력 패널 (독립 스크롤) */}
        {isDesktop && (
          <aside
            aria-label={t('calc.input.title')}
            className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-4"
          >
            {panelProps ? <InputPanel {...panelProps} variant="sidebar" /> : <PanelSkeleton />}
          </aside>
        )}

        <div className="min-w-0 space-y-5">
          {/* 태블릿: 상단 접이식 입력 패널(2열) */}
          {isTablet && (
            <div className="rounded-xl border border-border bg-surface px-4">
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
              {t('calc.error', { code: errorCode })}
            </p>
          )}

          <KpiRow result={result} previous={previous} pending={calc.isPending} locale={locale} />

          <Panel title={t('calc.gauge.title')}>
            {result && thresholds.data ? (
              <GaugeGroup metrics={result.current.metrics} thresholds={thresholds.data} />
            ) : (
              <Skeleton className="h-64" />
            )}
          </Panel>

          <Panel title={t('calc.diagram.title')}>
            {result ? <HrsgDiagram sections={result.sections} /> : <Skeleton className="h-56" />}
          </Panel>

          <Panel title={t('calc.trend.title')}>
            {result ? (
              <TrendChart
                series={result.sensitivity}
                currentY={result.loss.totalPowerLossMw}
                baseline={dpMetric?.baseline}
                band={thresholds.data?.hrsgGasDp}
              />
            ) : (
              <Skeleton className="h-[220px] md:h-[260px] lg:h-[300px]" />
            )}
          </Panel>

          <Panel title={t('calc.cleaning.title')}>
            {result ? (
              <CleaningCostTable
                rows={result.cleaningComparison}
                analysisYears={result.input.economics.analysisPeriodYears ?? 1}
              />
            ) : (
              <Skeleton className="h-48" />
            )}
          </Panel>

          <Panel title={t('calc.pinch.title')}>
            {result ? <PinchApproachPanel items={result.pinchApproach} /> : <Skeleton className="h-40" />}
          </Panel>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="text-muted">{t('calc.ask.hint')}</p>
              {result && <CalcMeta result={result} />}
            </div>
            <button
              type="button"
              disabled={!result}
              onClick={() => result && navigate('/chat', { state: { calcId: result.meta.calcId } })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
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

function KpiRow({
  result,
  previous,
  pending,
  locale,
}: {
  result?: CalcResult
  previous?: CalcResult
  pending: boolean
  locale: Locale
}) {
  const { t } = useTranslation()
  const mw = (v: number) => formatNumber(v, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const krw = (v: number) => formatKrwCompact(v, locale)
  const vsPrevious = t('calc.kpi.vsPrevious')

  return (
    // 4열은 카드 폭이 충분한 xl부터 (태블릿·좁은 노트북에서는 2×2)
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard
        testId="kpi-totalLoss"
        label={t('calc.kpi.totalLoss')}
        value={result?.loss.totalPowerLossMw}
        format={mw}
        unit="MW"
        delta={previous && result ? result.loss.totalPowerLossMw - previous.loss.totalPowerLossMw : null}
        deltaFormat={mw}
        deltaLabel={vsPrevious}
        loading={pending}
        sub={
          result &&
          t('calc.kpi.breakdown', { gt: mw(result.loss.gtPowerLossMw), st: mw(result.loss.stPowerLossMw) })
        }
      />
      <KpiCard
        testId="kpi-annualLoss"
        label={t('calc.kpi.annualLoss')}
        value={result?.loss.annualRevenueLossKrw}
        format={krw}
        fullValue={result && formatKrwFull(result.loss.annualRevenueLossKrw, locale)}
        delta={previous && result ? result.loss.annualRevenueLossKrw - previous.loss.annualRevenueLossKrw : null}
        deltaFormat={krw}
        deltaLabel={vsPrevious}
        loading={pending}
      />
      <KpiCard
        testId="kpi-annualRecovery"
        label={t('calc.kpi.annualRecovery')}
        value={result?.recovery.annualRecoveryKrw}
        format={krw}
        fullValue={result && formatKrwFull(result.recovery.annualRecoveryKrw, locale)}
        higherIsWorse={false}
        loading={pending}
        sub={result && t('calc.kpi.recoveryRate', { value: formatNumber(result.recovery.recoveryRatePct, locale) })}
      />
      <KpiCard
        testId="kpi-status"
        label={t('calc.kpi.overallStatus')}
        value={result?.current.foulingIndex}
        format={(v) => formatNumber(v, locale, { maximumFractionDigits: 1 })}
        unit={t('calc.kpi.foulingIndexUnit')}
        status={result?.current.overallStatus}
        loading={pending}
      />
    </div>
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

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />
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
