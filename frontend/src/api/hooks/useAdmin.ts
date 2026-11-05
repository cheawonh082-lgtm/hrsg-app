import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'

import { ApiError, apiFetch } from '../client'
import type {
  AdminConfig,
  AdminSession,
  AdminStatus,
  ReferenceList,
  ReferencePatch,
  ReferenceUpdateResult,
} from '../types'

const TOKEN_KEY = 'hrsg-admin-session'

/** 관리자 세션 — 탭을 닫으면 사라지도록 sessionStorage에 둔다 */
function readSession(): AdminSession | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as AdminSession | null
    return s && new Date(s.expiresAt).getTime() > Date.now() ? s : null
  } catch {
    return null
  }
}

function writeSession(s: AdminSession | null) {
  try {
    if (s) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(s))
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // 저장할 수 없으면 이 화면에서만 유지
  }
}

interface AdminSessionState {
  session: AdminSession | null
  /** 세션이 만료돼 로그아웃된 경우 로그인 화면에 안내 */
  expired: boolean
  login: (s: AdminSession) => void
  logout: (expired?: boolean) => void
}

export const useAdminSession = create<AdminSessionState>()((set) => ({
  session: readSession(),
  expired: false,
  login: (session) => {
    writeSession(session)
    set({ session, expired: false })
  },
  logout: (expired = false) => {
    writeSession(null)
    set({ session: null, expired })
  },
}))

/** 토큰을 붙여 부르고, 토큰이 무효(401)면 로그아웃한다 */
async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { session, logout } = useAdminSession.getState()
  try {
    return await apiFetch<T>(path, {
      ...init,
      headers: { ...init?.headers, ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) logout(true)
    throw e
  }
}

export function useAdminConfig() {
  return useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => apiFetch<AdminConfig>('/api/admin/config'),
    staleTime: 60_000,
  })
}

export function useAdminLogin() {
  const login = useAdminSession((s) => s.login)
  return useMutation({
    mutationFn: (password: string) =>
      apiFetch<AdminSession>('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
    onSuccess: login,
  })
}

export function useAdminStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'status'],
    queryFn: () => adminFetch<AdminStatus>('/api/admin/status'),
    enabled,
    retry: false,
  })
}

export const referencesKey = ['admin', 'references'] as const

export function useReferences(enabled: boolean) {
  return useQuery({
    queryKey: referencesKey,
    queryFn: () => adminFetch<ReferenceList>('/api/admin/references'),
    enabled,
    retry: false,
  })
}

export function useUpdateReference() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ docId, patch }: { docId: string; patch: ReferencePatch }) =>
      adminFetch<ReferenceUpdateResult>(`/api/admin/references/${encodeURIComponent(docId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    // 목록 전체를 다시 받는다 — corpus_all.json 동기화 경고 등 다른 문헌의 검사 결과도 바뀔 수 있다
    onSuccess: () => queryClient.invalidateQueries({ queryKey: referencesKey }),
  })
}
