/** PRD §7.1 오류 형식 { error: { code, messageKey, details } } 을 담는 예외 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly messageKey: string,
    public readonly details?: unknown,
  ) {
    super(code)
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers

  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'error.network')
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: Partial<ApiError> } | null
    const e = body?.error
    throw new ApiError(res.status, e?.code ?? 'HTTP_ERROR', e?.messageKey ?? 'error.http', e?.details)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
