const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

interface RequestOptions extends RequestInit {
  signal?: AbortSignal
}

async function retryRequest(
  fn: () => Promise<Response>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  signal?: AbortSignal,
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException('请求已取消', 'AbortError')

    try {
      const response = await fn()

      // 429 限流：读取 Retry-After 后重试
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After')
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : baseDelay * Math.pow(2, attempt)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }

      if (response.ok || response.status < 500) return response
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      lastError = e
    }

    if (attempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  throw lastError
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { signal, headers: customHeaders, ...restOptions } = options

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // 合并 headers：customHeaders 覆盖 defaultHeaders
  const mergedHeaders = {
    ...defaultHeaders,
    ...(customHeaders instanceof Headers
      ? Object.fromEntries(customHeaders.entries())
      : Array.isArray(customHeaders)
        ? Object.fromEntries(customHeaders)
        : customHeaders || {}),
  }

  const res = await retryRequest(
    () =>
      fetch(`${BASE_URL}${url}`, {
        ...restOptions,
        headers: mergedHeaders,
        signal,
      }),
    3,
    1000,
    signal,
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP Error ${res.status}: ${text}`)
  }

  return res.json()
}

async function uploadRequest<T>(url: string, formData: FormData, signal?: AbortSignal): Promise<T> {
  const res = await retryRequest(
    () =>
      fetch(`${BASE_URL}${url}`, {
        method: 'POST',
        body: formData,
        signal,
      }),
    3,
    1000,
    signal,
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Upload Error ${res.status}: ${text}`)
  }

  return res.json()
}

export const api = {
  get: <T>(url: string, options?: RequestOptions) => request<T>(url, { method: 'GET', ...options }),

  post: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  put: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T>(url: string, options?: RequestOptions) => request<T>(url, { method: 'DELETE', ...options }),

  upload: <T>(url: string, formData: FormData, signal?: AbortSignal) => uploadRequest<T>(url, formData, signal),
}
