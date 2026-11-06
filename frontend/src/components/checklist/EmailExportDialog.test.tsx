import '../../i18n'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToastStore } from '../../store/toast'
import { EmailExportDialog } from './EmailExportDialog'

/** 서버가 키트 emailDraft()로 만든 본문 형태 */
const result = (scope: string) => ({
  body: `HRSG 성능 진단을 위해 아래 데이터를 요청드립니다.\n\n[A. 가스터빈/운전]\n- A-01 GT 모델 및 정격 용량 (MW) — 출력 손실·정지 손실 계산의 기준 용량 [필수] (${scope})`,
  itemCount: 1,
})

let fetchMock: ReturnType<typeof vi.fn>

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <EmailExportDialog open onClose={() => {}} statesVersion="v1" />
    </QueryClientProvider>,
  )
}

const preview = () => screen.getByTestId('email-preview') as HTMLTextAreaElement
/** jsdom에는 navigator.clipboard가 없어 직접 정의한다 */
const setClipboard = (writeText: ReturnType<typeof vi.fn>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

const lastBody = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string)

beforeEach(() => {
  fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const req = JSON.parse(init.body as string)
    return new Response(JSON.stringify(result(req.scope)), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('EmailExportDialog', () => {
  it('서버 미리보기를 보여 주고, 옵션을 바꾸면 다시 요청한다', async () => {
    renderDialog()
    await waitFor(() => expect(preview().value).toContain('[A. 가스터빈/운전]'))
    expect(lastBody()).toEqual({ scope: 'unchecked' })

    await userEvent.click(screen.getByRole('button', { name: '전체 항목' }))
    await waitFor(() => expect(preview().value).toContain('(all)'))
    expect(lastBody()).toEqual({ scope: 'all' })
    // 키트 메일 문구는 한국어만 있어 언어 선택이 없다
    expect(screen.queryByLabelText('이메일 언어')).toBeNull()
  })

  it('실명·메모를 입력하는 칸이 없다', async () => {
    renderDialog()
    await waitFor(() => expect(preview().value).not.toBe(''))
    expect(screen.queryAllByRole('textbox').filter((el) => !(el as HTMLTextAreaElement).readOnly)).toHaveLength(0)
  })

  it('클립보드에 키트 메일 문구를 그대로 복사하고 토스트를 띄운다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)
    renderDialog()
    await waitFor(() => expect(preview().value).not.toBe(''))

    await userEvent.click(screen.getByRole('button', { name: '클립보드에 복사' }))
    expect(writeText).toHaveBeenCalledWith(preview().value)
    expect(writeText.mock.calls[0][0]).toMatch(/^HRSG 성능 진단을 위해 아래 데이터를 요청드립니다\./)
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('이메일 텍스트를 복사했습니다 (요청 항목 1개).')
  })

  it('클립보드를 쓸 수 없으면 텍스트를 선택해 두고 안내한다', async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    document.execCommand = vi.fn().mockReturnValue(false)
    renderDialog()
    await waitFor(() => expect(preview().value).not.toBe(''))

    await userEvent.click(screen.getByRole('button', { name: '클립보드에 복사' }))
    expect(document.activeElement).toBe(preview())
    expect(preview().selectionEnd - preview().selectionStart).toBe(preview().value.length)
    expect(screen.getByText(/텍스트를 선택해 두었습니다/)).toBeInTheDocument()
  })
})
