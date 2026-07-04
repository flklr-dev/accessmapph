import { apiFetch } from './http'
import type { AppUser } from '../types/auth'

export async function fetchCurrentUser(): Promise<AppUser> {
  const data = await apiFetch<{ user: AppUser }>('/api/auth/me', { auth: true })
  return data.user
}
