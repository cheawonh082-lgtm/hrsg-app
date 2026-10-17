import '../../i18n'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToastStore } from '../../store/toast'
import { EmailExportDialog } from './EmailExportDialog'

const result = (scope: string) => ({
  subject: '[HRSG 성능 진단] 플랜트 데이터 요청드립니다',
  body: `안녕하세요, 고객사 담당자님.\n■ 가스터빈\n  1. 부하별 운전 이력 [필수] (${scope})`,
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
    await waitFor(() => expect(preview().value).toContain('제목: [HRSG 성능 진단]'))
    expect(lastBody()).toEqual({ scope: 'unchecked', locale: 'ko', includeMemo: false, recipientAlias: 'customer_contact' })

    await userEvent.click(screen.getByRole('button', { name: '전체 항목' }))
    await waitFor(() => expect(preview().value).toContain('(all)'))

    await userEvent.selectOptions(screen.getByLabelText('받는 사람 (별칭)'), 'plant_operations')
    await userEvent.click(screen.getByLabelText(/메모 포함/))
    await waitFor(() => expect(lastBody()).toMatchObject({ recipientAlias: 'plant_operations', includeMemo: true }))
  })

  it('수신자 실명을 입력하는 칸이 없다 (별칭 선택만)', async () => {
    renderDialog()
    await waitFor(() => expect(preview().value).not.toBe(''))
    expect(screen.queryAllByRole('textbox').filter((el) => !(el as HTMLTextAreaElement).readOnly)).toHaveLength(0)
  })

  it('클립보드에 제목+본문을 복사하고 토스트를 띄운다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)
    renderDialog()
    await waitFor(() => expect(preview().value).not.toBe(''))

    await userEvent.click(screen.getByRole('button', { name: '클립보드에 복사' }))
    expect(writeText).toHaveBeenCalledWith(preview().value)
    expect(writeText.mock.calls[0][0]).toMatch(/^제목: \[HRSG 성능 진단\][\s\S]*안녕하세요, 고객사 담당자님\./)
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
