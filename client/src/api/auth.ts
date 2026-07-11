import { apiFetch } from './http'
import type { AppUser, UserContribution } from '../types/auth'

export async function fetchCurrentUser(): Promise<AppUser> {
  const data = await apiFetch<{ user: AppUser }>('/api/auth/me', { auth: true })
  return data.user
}

export async function fetchMyContributions(): Promise<{
  user: AppUser
  contributions: UserContribution[]
}> {
  return apiFetch<{ user: AppUser; contributions: UserContribution[] }>(
    '/api/auth/me/contributions',
    { auth: true },
  )
}

/** Queue permanent account deletion (processed asynchronously on the server). */
export async function deleteAccount(): Promise<{ accepted: boolean; jobId: string }> {
  return apiFetch<{ accepted: boolean; jobId: string; message?: string }>('/api/auth/me', {
    method: 'DELETE',
    auth: true,
  })
}
