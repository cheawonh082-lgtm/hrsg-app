import '../../i18n'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { formatKrwCompact, formatNumber } from '../../lib/format'
import { KpiCard } from './KpiCard'

const mw = (v: number) => formatNumber(v, 'ko', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const krw = (v: number) => formatKrwCompact(v, 'ko')

describe('KpiCard 수치 포맷', () => {
  it('값을 포맷 함수로 표시하고 단위를 붙인다', () => {
    render(<KpiCard testId="kpi" label="총 출력 손실" value={3.1567} format={mw} unit="MW" />)
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('3.16')
    expect(screen.getByText('MW')).toBeInTheDocument()
    expect(screen.getByText('총 출력 손실')).toBeInTheDocument()
  })

  it('0도 소수 둘째 자리까지 표시한다', () => {
    render(<KpiCard testId="kpi" label="손실" value={0} format={mw} unit="MW" />)
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('0.00')
  })

  it('값이 없으면 대시를 표시한다', () => {
    render(<KpiCard testId="kpi" label="손실" value={undefined} format={mw} />)
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('–')
  })

  it('큰 금액은 축약하고 전체 값은 title로 제공한다 (R-5)', () => {
    render(
      <KpiCard testId="kpi" label="연간 손실" value={2_876_400_000} format={krw} fullValue="2,876,400,000 원" />,
    )
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('28.8억 원')
    expect(screen.getByTitle('2,876,400,000 원')).toBeInTheDocument()
  })

  it('영어 로케일 축약 표기', () => {
    render(<KpiCard testId="kpi" label="Annual" value={2_876_400_000} format={(v) => formatKrwCompact(v, 'en')} />)
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('2.9B KRW')
  })

  it('증가는 ▲ + 위험색 (값이 클수록 나쁜 지표)', () => {
    render(<KpiCard label="손실" value={3.16} format={mw} delta={0.42} deltaFormat={mw} deltaLabel="직전 계산 대비" />)
    const delta = screen.getByText('▲', { exact: false }).closest('p')!
    expect(delta).toHaveTextContent('0.42')
    expect(delta).toHaveTextContent('직전 계산 대비')
    expect(delta).toHaveClass('text-status-danger')
  })

  it('감소는 ▼ + 정상색', () => {
    render(<KpiCard label="손실" value={1} format={mw} delta={-0.5} deltaFormat={mw} />)
    const delta = screen.getByText('▼', { exact: false }).closest('p')!
    expect(delta).toHaveTextContent('0.50')
    expect(delta).toHaveClass('text-status-normal')
  })

  it('higherIsWorse=false면 증가가 정상색', () => {
    render(<KpiCard label="회수" value={2} format={mw} delta={1} deltaFormat={mw} higherIsWorse={false} />)
    expect(screen.getByText('▲', { exact: false }).closest('p')).toHaveClass('text-status-normal')
  })

  it('차이가 0이면 표시하지 않는다', () => {
    render(<KpiCard label="손실" value={1} format={mw} delta={0} />)
    expect(screen.queryByText('▲', { exact: false })).toBeNull()
    expect(screen.queryByText('▼', { exact: false })).toBeNull()
  })

  it('상태 Pill을 색·아이콘·텍스트로 표시한다', () => {
    render(<KpiCard label="상태" value={80} format={String} status="danger" />)
    expect(screen.getByText('위험')).toHaveAttribute('data-status', 'danger')
  })

  it('값이 바뀌면 새 값으로 갱신된다 (동작 줄이기 설정이면 즉시)', () => {
    const { rerender } = render(<KpiCard testId="kpi" label="손실" value={1} format={mw} />)
    rerender(<KpiCard testId="kpi" label="손실" value={2.5} format={mw} />)
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('2.50')
  })
})
