import '../../i18n'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BottomSheet } from './BottomSheet'
import { Drawer } from './Drawer'

describe('BottomSheet', () => {
  const renderSheet = (onClose = vi.fn()) =>
    render(
      <BottomSheet open onClose={onClose} title="입력 조정" summary={<span>총 손실 3.16 MW</span>}>
        <input aria-label="값" />
      </BottomSheet>,
    )

  it('제목·요약을 가진 모달 대화상자로 열리고 50% 높이에서 시작한다', () => {
    renderSheet()
    const dialog = screen.getByRole('dialog', { name: '입력 조정' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('data-snap', '0')
    expect(dialog.style.height).toBe('50dvh')
    expect(screen.getByText('총 손실 3.16 MW')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden') // 배경 스크롤 잠금
  })

  it('손잡이 버튼으로 50% ↔ 90% 전환', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: '시트 높이 전환' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('data-snap', '1')
    expect(screen.getByRole('dialog').style.height).toBe('90dvh')
  })

  it('Esc·닫기 버튼으로 닫힌다', () => {
    const onClose = vi.fn()
    renderSheet(onClose)
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    render(
      <BottomSheet open={false} onClose={() => {}} title="입력 조정">
        내용
      </BottomSheet>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Drawer', () => {
  it('열리면 패널로 포커스가 이동하고 Esc로 닫힌다', () => {
    const onClose = vi.fn()
    render(
      <Drawer open onClose={onClose} title="대화 목록">
        <button type="button">대화 1</button>
      </Drawer>,
    )
    const dialog = screen.getByRole('dialog', { name: '대화 목록' })
    expect(dialog).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
