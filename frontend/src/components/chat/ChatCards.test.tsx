import '../../i18n'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { CalcResultCard as CardData, GasTurbineSpec, InputLimits, ParamConfirmCard as ConfirmData } from '../../api/types'
import { CalcResultCard } from './CalcResultCard'
import { ParamConfirmCard } from './ParamConfirmCard'

const models: GasTurbineSpec[] = [
  { modelId: 'GT_MOCK_F_CLASS', displayName: 'F-Class GT (Mock)', ratedPowerMw: 270, ratedExhaustFlowKgS: 650, ratedExhaustTempC: 600 },
  { modelId: 'GT_MOCK_H_CLASS', displayName: 'H-Class GT (Mock)', ratedPowerMw: 380, ratedExhaustFlowKgS: 800, ratedExhaustTempC: 640 },
]

const limits = {
  condition: {
    hrsgGasDpMbar: { min: 0, max: 100, exclusiveMin: false, exclusiveMax: false, integer: false, nullable: false },
    stackTempC: { min: 60, max: 250, exclusiveMin: false, exclusiveMax: false, integer: false, nullable: false },
  },
  economics: {},
} as InputLimits

const card: CardData = {
  type: 'calc_result',
  calcId: 'calc-123',
  isMock: true,
  status: 'danger',
  headline: [
    { key: 'totalPowerLossMw', value: 3.1567, unit: 'MW' },
    { key: 'annualRevenueLossKrw', value: 2_876_400_000, unit: 'KRW' },
    { key: 'annualRecoveryKrw', value: 2_012_920_000, unit: 'KRW' },
    { key: 'foulingIndex', value: 80, unit: '/100', status: 'danger' },
  ],
  assumptions: [
    { key: 'gtModelId', value: 'GT_MOCK_F_CLASS', source: 'user' },
    { key: 'hrsgGasDpMbar', value: 35, unit: 'mbar', source: 'user' },
    { key: 'gtLoadPct', value: 100, unit: '%', source: 'default' },
  ],
  recommendedMethodId: 'dry_ice',
}

function LocationProbe() {
  const loc = useLocation()
  return <p data-testid="location">{loc.pathname + loc.search}</p>
}

describe('CalcResultCard', () => {
  it('서버가 준 값을 포맷해 보여 주고 사용자 값과 기본값을 나눈다', () => {
    render(
      <MemoryRouter>
        <CalcResultCard card={card} models={models} />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('card-totalPowerLossMw')).toHaveTextContent('3.16 MW')
    expect(screen.getByTestId('card-annualRevenueLossKrw')).toHaveTextContent('28.8억 원')
    expect(screen.getByTestId('card-annualRevenueLossKrw')).toHaveAttribute('title', '2,876,400,000 원')
    expect(screen.getByTestId('card-foulingIndex')).toHaveTextContent('80 / 100')
    expect(screen.getByText('MOCK')).toBeInTheDocument()
    expect(screen.getByText('드라이아이스 블라스팅')).toBeInTheDocument()

    const user = within(screen.getByTestId('assumptions-user'))
    expect(user.getByText('F-Class GT (Mock)')).toBeInTheDocument()
    expect(user.getByText(/35 mbar/)).toBeInTheDocument()
    expect(within(screen.getByTestId('assumptions-default')).getByText(/100 %/)).toBeInTheDocument()
  })

  it('"계산기에서 열기"는 calcId를 쿼리로 넘긴다 (A-09)', async () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route path="/chat" element={<CalcResultCard card={card} models={models} />} />
          <Route path="/calculator" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: '계산기에서 열기' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/calculator?calcId=calc-123')
  })
})

describe('ParamConfirmCard', () => {
  const confirm: ConfirmData = {
    type: 'param_confirm',
    extracted: { condition: { stackTempC: 110 } },
    missing: ['gtModelId', 'hrsgGasDpMbar'],
    defaultsProposed: { gtModelId: 'GT_MOCK_H_CLASS', hrsgGasDpMbar: 28 },
  }

  it('빠진 값은 기본값을 제안하고, 확인하면 질문 값과 합쳐 보낸다', async () => {
    const onSubmit = vi.fn()
    render(<ParamConfirmCard card={confirm} models={models} limits={limits} onSubmit={onSubmit} />)

    expect(screen.getByLabelText('가스터빈 모델', { exact: false })).toHaveValue('GT_MOCK_H_CLASS')
    expect(screen.getByRole('textbox', { name: /HRSG 차압.*기본값 제안/ })).toHaveValue('28')
    expect(screen.getByRole('textbox', { name: /스택 온도/ })).toHaveValue('110')

    await userEvent.click(screen.getByRole('button', { name: '계산 실행' }))
    expect(onSubmit).toHaveBeenCalledWith({
      gtModelId: 'GT_MOCK_H_CLASS',
      condition: { stackTempC: 110, hrsgGasDpMbar: 28 },
      economics: {},
    })
  })

  it('범위를 벗어나면 오류를 보여 주고 보내지 않는다', async () => {
    const onSubmit = vi.fn()
    render(<ParamConfirmCard card={confirm} models={models} limits={limits} onSubmit={onSubmit} />)

    const stack = screen.getByRole('textbox', { name: /스택 온도/ })
    await userEvent.clear(stack)
    await userEvent.type(stack, '300')
    await userEvent.click(screen.getByRole('button', { name: '계산 실행' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('250')
  })
})
