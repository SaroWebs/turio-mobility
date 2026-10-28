const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || '/api/customer-app'
// The strict v1 contract surface lives beside the legacy base: /api/customer-app -> /api/v1.
export const API_V1_BASE = API_BASE_URL.endsWith('/customer-app')
  ? `${API_BASE_URL.slice(0, -'/customer-app'.length)}/v1`
  : '/api/v1'
const TOKEN_KEY = 'skyslope_customer_token'

export type ApiResult<T> = {
  data: T | null
  error: string | null
  status?: number
  code?: string
  requestId?: string
}

export type ApiRequestOptions = {
  /**
   * Enable bounded same-key retry on lost responses (network error / 5xx / 409).
   * Only set for endpoints protected by the server's idempotency middleware — a
   * retry on an unprotected mutation could double-submit.
   */
  retry?: boolean
  /** Override the base URL, e.g. API_V1_BASE for the strict v1 surface. */
  baseUrl?: string
}

export function getAuthToken() {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

/** Flatten a Laravel-style `{ field: [messages] }` bag into a single string. */
function flattenMessages(bag: unknown): string {
  const record = asRecord(bag)
  if (!record) return ''
  return Object.values(record)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
}

function generateIdempotencyKey(): string {
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID()
  }
  // Fallback for non-secure contexts (plain http on a LAN IP) where randomUUID is unavailable.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
}

function backoff(attempt: number): Promise<void> {
  const ms = attempt === 1 ? 300 : 900
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  const payload = await response.json().catch(() => null)
  const obj = asRecord(payload)
  const meta = asRecord(obj?.meta)
  const requestId =
    (typeof meta?.request_id === 'string' ? meta.request_id : undefined) ??
    response.headers.get('X-Request-Id') ??
    undefined

  if (!response.ok) {
    // Strict v1 envelope first: { success:false, error:{ code, message, fields } }.
    const errObj = asRecord(obj?.error)
    const code = typeof errObj?.code === 'string' ? errObj.code : undefined
    let message = typeof errObj?.message === 'string' ? errObj.message : ''
    if (!message && errObj?.fields) {
      message = flattenMessages(errObj.fields)
    }
    // Legacy shapes: { message } and/or { errors: { field: [msgs] } }.
    if (!message && typeof obj?.message === 'string') {
      message = obj.message
    }
    if (!message && obj?.errors) {
      message = flattenMessages(obj.errors)
    }
    if (!message) {
      message = 'Request failed. Please try again.'
    }

    // Surface the correlation id for support without cluttering the UI.
    console.warn('[api] request failed', { status: response.status, code, requestId, message })

    return { data: null, error: message, status: response.status, code, requestId }
  }

  if (payload === null) {
    return {
      data: null,
      error: 'Turiya Mobility returned an unreadable service response.',
      status: response.status,
      requestId,
    }
  }

  return { data: payload as T, error: null, status: response.status, requestId }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  opts: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const token = getAuthToken()
  const headers = new Headers(options.headers)

  headers.set('Accept', 'application/json')

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const method = (options.method ?? 'GET').toUpperCase()
  const isMutation = method !== 'GET' && method !== 'HEAD'

  // Exactly-once support: attach a stable Idempotency-Key to every mutation. Harmless on
  // endpoints without the server middleware; where present, a retry with the same key and
  // identical body replays the original response instead of repeating the side effect.
  // Generated once and reused across retries below so a lost response cannot double-charge.
  if (isMutation && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', generateIdempotencyKey())
  }

  const baseUrl = opts.baseUrl ?? API_BASE_URL
  const maxAttempts = opts.retry ? 3 : 1
  let lastResult: ApiResult<T> = { data: null, error: 'Request failed. Please try again.' }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, { ...options, headers })
    } catch {
      lastResult = {
        data: null,
        error: 'Could not connect. Please check your internet connection and try again.',
      }
      if (opts.retry && attempt < maxAttempts) {
        await backoff(attempt)
        continue
      }
      return lastResult
    }

    const result = await parseResponse<T>(response)
    lastResult = result

    // Retry only lost/uncommitted responses, and only when the caller opted in
    // (i.e. the endpoint is idempotency-protected server-side).
    const retryable = opts.retry && (response.status >= 500 || response.status === 409)
    if (retryable && attempt < maxAttempts) {
      await backoff(attempt)
      continue
    }

    // Retries exhausted while the original is still processing upstream.
    if (opts.retry && response.status === 409) {
      return {
        ...result,
        error: 'Your request is still being processed. Please check your bookings or wallet before trying again.',
      }
    }

    return result
  }

  return lastResult
}
