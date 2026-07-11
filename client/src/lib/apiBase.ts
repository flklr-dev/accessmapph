/**
 * Production API host (Render). Leave empty in local dev — Vite proxies `/api` to localhost:3001.
 * Example: https://accessmapph-api.onrender.com
 */
export function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
  return base.replace(/\/$/, '')
}

/** Resolve `/api/...` against the configured API base URL. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = getApiBaseUrl()
  return base ? `${base}${normalized}` : normalized
}
