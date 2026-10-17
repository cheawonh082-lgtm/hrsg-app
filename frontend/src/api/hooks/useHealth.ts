import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '../client'
import type { HealthStatus } from '../types'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthStatus>('/api/health'),
    staleTime: 60_000,
    retry: 1,
  })
}
