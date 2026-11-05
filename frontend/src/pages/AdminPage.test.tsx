import '../i18n'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAdminSession } from '../api/hooks/useAdmin'
import type { ReferenceDoc, ReferenceList } from '../api/types'
import { useToastStore } from '../store/toast'
import { AdminPage } from './AdminPage'

const doc = (docId: string, title: string, extra: Partial<ReferenceDoc> = {}): ReferenceDoc => ({
  docId,
  title,
  authors: ['A. Kim', 'B. Lee'],
  year: 2020,
  venue: 'Energy',
  doi: '',
  url: '',
  lang: 'en',
  license: '',
  sourceType: 'paraphrase',
  sourceFile: `${docId}.pdf`,
  paragraphCount: 3,
  pages: '1–3',
  ...extra,
})

const LIST: ReferenceList = {
  configured: true,
  corpusDir: '../rag_corpus',
  corpusAllPath: '../corpus_all.json',
  documents: [doc('R001', '', { authors: [], year: null }), doc('R002', 'Performance Analysis of a Triple Pressure HRSG')],
  issues: [
    { level: 'warning', code: 'empty_title', docId: 'R001', field: 'title' },
    { level: 'warning', code: 'no_authors', docId: 'R001', field: 'authors' },
  ],
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>
let routes: Record<string, (init?: RequestInit) => Response>

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AdminPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  useAdminSession.setState({ session: null, expired: false })
  useToastStore.setState({ toasts: [] })
  routes = {
    'GET /api/admin/config': () => json({ enabled: true }),
    'POST /api/admin/login': (init) =>
      JSON.parse(init!.body as string).password === 'pw'
        ? json({ token: 'tok', expiresAt: new Date(Date.now() + 3600_000).toISOString() })
        : json({ error: { code: 'ADMIN_BAD_PASSWORD', messageKey: 'admin.errors.ADMIN_BAD_PASSWORD' } }, 401),
    'GET /api/admin/references': () => json(LIST),
  }
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const handler = routes[`${init?.method ?? 'GET'} ${url}`]
    return handler ? handler(init) : json({ error: { code: 'NOT_FOUND', messageKey: 'error.http' } }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function login(password = 'pw') {
  const input = await screen.findByLabelText('비밀번호')
  await userEvent.type(input, password)
  await userEvent.click(screen.getByRole('button', { name: '로그인' }))
}

describe('AdminPage', () => {
  it('ADMIN_PASSWORD가 없으면 꺼져 있다고 안내한다', async () => {
    routes['GET /api/admin/config'] = () => json({ enabled: false })
    renderPage()
    expect(await screen.findByText('관리자 모드가 꺼져 있습니다')).toBeInTheDocument()
    expect(screen.queryByLabelText('비밀번호')).toBeNull()
  })

  it('비밀번호가 틀리면 오류, 맞으면 토큰으로 참고문헌 목록을 받는다', async () => {
    renderPage()
    await login('wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent('비밀번호가 올바르지 않습니다')

    await userEvent.clear(screen.getByLabelText('비밀번호'))
    await login('pw')
    expect(await screen.findByTestId('refs-summary')).toHaveTextContent('문헌 2건 · 오류 0건 · 경고 2건')
    expect(screen.getByText('제목 없음')).toBeInTheDocument()
    const refsCall = fetchMock.mock.calls.find(([url]) => url === '/api/admin/references')!
    expect(refsCall[1].headers).toMatchObject({ Authorization: 'Bearer tok' })

    // 문제 있는 문헌만 보기
    await userEvent.click(screen.getByRole('button', { name: '문제 있는 문헌' }))
    expect(screen.queryByText('Performance Analysis of a Triple Pressure HRSG')).toBeNull()
  })

  it('서지 정보 편집은 바뀐 필드만 보내고 검색 서버 반영 결과를 알린다', async () => {
    routes['PATCH /api/admin/references/R001'] = () =>
      json({ document: doc('R001', 'New title'), issues: [], ragSync: 'reloaded' })
    renderPage()
    await login()
    await userEvent.click(await screen.findByRole('button', { name: 'R001 서지 정보 편집' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('제목이 없습니다')
    await userEvent.type(within(dialog).getByLabelText('제목'), 'New title')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(useToastStore.getState().toasts[0]?.message).toBe('저장했습니다. 검색 서버에 바로 반영되었습니다.'))
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(patch[1].body as string)).toEqual({ title: 'New title' })
  })

  it('토큰이 무효(401)면 로그인 화면으로 돌아간다', async () => {
    routes['GET /api/admin/references'] = () =>
      json({ error: { code: 'ADMIN_UNAUTHORIZED', messageKey: 'admin.errors.ADMIN_UNAUTHORIZED' } }, 401)
    renderPage()
    await login()
    expect(await screen.findByText('세션이 만료되었습니다. 다시 로그인하세요.')).toBeInTheDocument()
    expect(sessionStorage.getItem('hrsg-admin-session')).toBeNull()
  })
})
