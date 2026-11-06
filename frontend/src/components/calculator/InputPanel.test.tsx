import '../../i18n'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CalcInput, FieldLimit, GasTurbineSpec, InputLimits } from '../../api/types'
import { CALC_DEBOUNCE_MS, useCalculate } from '../../hooks/useCalculate'
import type { CalcDraft } from '../../lib/calcDraft'
import { InputPanel } from './InputPanel'

const lim = (l: Partial<FieldLimit>): FieldLimit => ({
  exclusiveMin: false,
  exclusiveMax: false,
  integer: false,
  nullable: false,
  ...l,
})

// 백엔드 /api/calc/input-limits 와 같은 형태의 고정값
const LIMITS: InputLimits = {
  condition: {
    gtLoadPct: lim({ min: 30, max: 100 }),
    ambientTempC: lim({ min: -20, max: 45 }),
    exhaustTempC: lim({ min: 450, max: 680 }),
    exhaustFlowKgS: lim({ min: 0, exclusiveMin: true }),
    gtBackPressureMbar: lim({ min: 0, max: 100 }),
    hrsgGasDpMbar: lim({ min: 0, max: 100 }),
    stackTempC: lim({ min: 60, max: 250 }),
    hpDrumPressureBarg: lim({ min: 0, max: 200, nullable: true }),
  },
  economics: {
    electricityPriceKrwPerMwh: lim({ min: 0, exclusiveMin: true }),
    monthlyOperatingHours: lim({ min: 1, max: 744, integer: true }),
    annualOperatingHours: lim({ min: 0, max: 8760, integer: true }),
  },
}

const MODELS = [{ modelId: 'GT_MOCK_F_CLASS', displayName: 'F-Class GT (Mock)' }] as GasTurbineSpec[]

const DRAFT: CalcDraft = {
  gtModelId: 'GT_MOCK_F_CLASS',
  condition: {
    gtLoadPct: 100,
    ambientTempC: 15,
    exhaustTempC: 600,
    exhaustFlowKgS: 650,
    gtBackPressureMbar: 30,
    hrsgGasDpMbar: 25,
    stackTempC: 90,
    hpDrumPressureBarg: 120,
  },
  economics: { electricityPriceKrwPerMwh: 150000, monthlyOperatingHours: 720, annualOperatingHours: 8000 },
}

const fetchMock = vi.fn()

/** 마지막 /api/calc/evaluate 요청 본문 */
const lastBody = () => JSON.parse(fetchMock.mock.lastCall![1].body) as CalcInput
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function Harness() {
  const [draft, setDraft] = useState(DRAFT)
  const calc = useCalculate(draft, LIMITS)
  return (
    <>
      <InputPanel
        draft={draft}
        limits={LIMITS}
        errors={calc.errors}
        models={MODELS}
        isBlocked={calc.isBlocked}
        onDraftChange={setDraft}
        onModelChange={() => {}}
        onReset={() => setDraft(DRAFT)}
        variant="sidebar"
      />
      <output data-testid="loss">{calc.result?.loss.totalPowerLossMw ?? '-'}</output>
    </>
  )
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  // 응답의 손실 값 = 요청한 ΔP (요청이 어떤 입력으로 갔는지 화면에서 확인용)
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as CalcInput
    return { ok: true, status: 200, json: async () => ({ loss: { totalPowerLossMw: body.condition.hrsgGasDpMbar } }) }
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('InputPanel + useCalculate', () => {
  it('첫 입력값은 바로 계산을 요청한다', async () => {
    renderPanel()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/calc/evaluate')
    expect(lastBody().condition.hrsgGasDpMbar).toBe(25)
    expect(await screen.findByText('25')).toHaveAttribute('data-testid', 'loss')
  })

  it(`연속 입력은 ${CALC_DEBOUNCE_MS}ms 디바운스 후 마지막 값으로 한 번만 요청한다`, async () => {
    renderPanel()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const dp = screen.getByLabelText('HRSG 차압 (ΔP)')
    fireEvent.change(dp, { target: { value: '30' } })
    fireEvent.change(dp, { target: { value: '32' } })
    fireEvent.change(dp, { target: { value: '35' } })

    await sleep(CALC_DEBOUNCE_MS / 2)
    expect(fetchMock).toHaveBeenCalledTimes(1) // 아직 대기 중

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(lastBody().condition.hrsgGasDpMbar).toBe(35)
    await waitFor(() => expect(screen.getByTestId('loss')).toHaveTextContent('35'))

    await sleep(CALC_DEBOUNCE_MS + 100)
    expect(fetchMock).toHaveBeenCalledTimes(2) // 추가 요청 없음
  })

  it('슬라이더를 움직이면 숫자 칸과 요청 값이 함께 바뀐다', async () => {
    renderPanel()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('HRSG 차압 (ΔP) 슬라이더'), { target: { value: '40' } })
    expect(screen.getByLabelText('HRSG 차압 (ΔP)')).toHaveValue('40')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(lastBody().condition.hrsgGasDpMbar).toBe(40)
  })

  it('범위를 벗어나면 오류를 표시하고 계산을 요청하지 않는다', async () => {
    renderPanel()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('GT 배기온도'), { target: { value: '800' } })

    expect(await screen.findByText('680 이하여야 합니다.')).toBeInTheDocument()
    expect(screen.getByLabelText('GT 배기온도')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/재계산을 멈췄습니다/)).toBeInTheDocument()
    await sleep(CALC_DEBOUNCE_MS + 100)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('loss')).toHaveTextContent('25') // 마지막 정상 결과 유지
  })

  it('오류를 고치면 다시 계산한다', async () => {
    renderPanel()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const exhaust = screen.getByLabelText('GT 배기온도')
    fireEvent.change(exhaust, { target: { value: '800' } })
    await screen.findByText('680 이하여야 합니다.')
    fireEvent.change(exhaust, { target: { value: '610' } })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(lastBody().condition.exhaustTempC).toBe(610)
    expect(screen.queryByText('680 이하여야 합니다.')).toBeNull()
  })

  it('필수 칸을 비우거나 숫자가 아니면 각각 다른 오류를 표시한다', async () => {
    renderPanel()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('스택 온도'), { target: { value: '' } })
    expect(await screen.findByText('값을 입력하세요.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('GT 배압'), { target: { value: 'abc' } })
    expect(await screen.findByText('숫자를 입력하세요.')).toBeInTheDocument()
  })

  it('정수 항목에 소수를 넣으면 오류', async () => {
    renderPanel()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /경제성/ }))
    fireEvent.change(screen.getByLabelText('연간 운전시간'), { target: { value: '7999.5' } })
    expect(await screen.findByText('정수를 입력하세요.')).toBeInTheDocument()
    // 접힌 그룹에도 오류 개수 표시
    fireEvent.click(screen.getByRole('button', { name: /경제성/ }))
    expect(screen.getByRole('button', { name: /경제성/ })).toHaveTextContent('오류 1개')
  })

  it('비워 둘 수 있는 항목은 지우기 버튼으로 null 전송', async () => {
    renderPanel()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /고급 입력/ }))
    fireEvent.click(screen.getByRole('button', { name: 'HP 드럼 압력 비우기' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(lastBody().condition.hpDrumPressureBarg).toBeNull()
  })
})
