import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { create } from 'zustand'

import { computeProgress, mergeState } from '../../lib/checklist'
import type { Locale } from '../../store/ui'
import { apiFetch } from '../client'
import type {
  ChecklistItemPatch,
  ChecklistItemState,
  ChecklistResponse,
  EmailExportRequest,
  EmailExportResult,
} from '../types'

const PENDING_KEY = 'hrsg-checklist-pending'

/** 서버에 아직 저장되지 않은 변경 (항목 id → 누적 변경). 새로고침해도 남도록 localStorage에 백업한다. */
type Pending = Record<string, ChecklistItemPatch>

function readPending(): Pending {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}') as Pending
  } catch {
    return {}
  }
}

function writePending(pending: Pending) {
  try {
    if (Object.keys(pending).length) localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    // 저장 공간을 쓸 수 없으면 백업만 생략
  }
}

/** 화면에 "저장되지 않은 변경 n개" 배너를 띄우기 위한 카운트 */
export const usePendingStore = create<{ count: number; set: (n: number) => void }>()((set) => ({
  count: Object.keys(readPending()).length,
  set: (count) => set({ count }),
}))

export const checklistKey = (locale: Locale) => ['checklist', locale] as const

export function useChecklist(locale: Locale) {
  return useQuery({
    queryKey: checklistKey(locale),
    queryFn: () => apiFetch<ChecklistResponse>(`/api/checklist?locale=${locale}`),
    staleTime: 30_000,
  })
}

/** 모든 로케일 캐시에 같은 상태 변경을 반영하고 진행률을 다시 계산한다(서버 응답 전 즉시 표시) */
function applyToCache(queryClient: QueryClient, itemId: string, patch: Partial<ChecklistItemState>) {
  queryClient.setQueriesData<ChecklistResponse>({ queryKey: ['checklist'] }, (old) => {
    if (!old?.states) return old
    const states = mergeState(old.states, itemId, patch)
    return {
      ...old,
      states,
      progress: computeProgress(old.items, states, old.categories.map((c) => c.id)),
    }
  })
}

/**
 * 항목 변경 (PRD §3.3 저장): 화면에 즉시 반영(낙관적 업데이트) → PATCH.
 * 실패하면 변경을 localStorage에 남기고, retryPending()이나 다음 화면 진입 때 다시 보낸다.
 */
export function useChecklistMutations() {
  const queryClient = useQueryClient()
  const setCount = usePendingStore((s) => s.set)

  const send = useCallback(
    async (itemId: string, patch: ChecklistItemPatch) => {
      try {
        const saved = await apiFetch<ChecklistItemState>(`/api/checklist/items/${encodeURIComponent(itemId)}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        })
        const pending = readPending()
        delete pending[itemId]
        writePending(pending)
        setCount(Object.keys(pending).length)
        applyToCache(queryClient, itemId, { updatedAt: saved.updatedAt })
        return true
      } catch {
        const pending = readPending()
        pending[itemId] = { ...pending[itemId], ...patch }
        writePending(pending)
        setCount(Object.keys(pending).length)
        return false
      }
    },
    [queryClient, setCount],
  )

  const update = useCallback(
    (itemId: string, patch: ChecklistItemPatch) => {
      applyToCache(queryClient, itemId, patch as Partial<ChecklistItemState>)
      return send(itemId, patch)
    },
    [queryClient, send],
  )

  const retryPending = useCallback(async () => {
    const pending = readPending()
    const results = await Promise.all(Object.entries(pending).map(([id, patch]) => send(id, patch)))
    return results.every(Boolean)
  }, [send])

  const reset = useCallback(async () => {
    await apiFetch<void>('/api/checklist/reset', { method: 'POST' })
    writePending({})
    setCount(0)
    await queryClient.invalidateQueries({ queryKey: ['checklist'] })
  }, [queryClient, setCount])

  return { update, retryPending, reset }
}

/** 데이터를 처음 받았을 때 백업된 미저장 변경을 화면에 다시 얹고 서버로 재전송 */
export function useRestorePending(loaded: boolean) {
  const queryClient = useQueryClient()
  const { retryPending } = useChecklistMutations()
  const done = useRef(false)

  useEffect(() => {
    if (!loaded || done.current) return
    done.current = true
    const pending = readPending()
    if (!Object.keys(pending).length) return
    for (const [id, patch] of Object.entries(pending)) applyToCache(queryClient, id, patch as Partial<ChecklistItemState>)
    void retryPending()
  }, [loaded, queryClient, retryPending])
}

/** 이메일 미리보기 — 옵션이나 체크 상태가 바뀌면 다시 받는다 */
export function useEmailPreview(req: EmailExportRequest, statesVersion: string, enabled: boolean) {
  return useQuery({
    queryKey: ['checklist-email', req, statesVersion],
    queryFn: () =>
      apiFetch<EmailExportResult>('/api/checklist/export-email', { method: 'POST', body: JSON.stringify(req) }),
    enabled,
    placeholderData: (prev) => prev,
  })
}
