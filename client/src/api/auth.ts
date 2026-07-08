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

/** Permanently delete the signed-in account (server + Firebase Auth). */
export async function deleteAccount(): Promise<void> {
  await apiFetch<{ success: boolean }>('/api/auth/me', {
    method: 'DELETE',
    auth: true,
  })
}
