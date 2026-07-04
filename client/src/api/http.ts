import { getIdToken } from '../lib/authSession'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Attach Firebase ID token (default true for mutating methods) */
  auth?: boolean
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const needsAuth = options.auth ?? method !== 'GET'
  const headers = new Headers(options.headers)

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (needsAuth) {
    const token = await getIdToken()
    if (!token) {
      throw new ApiError('Sign in required.', 401)
    }
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'Request failed.',
      response.status,
    )
  }

  return data as T
}
