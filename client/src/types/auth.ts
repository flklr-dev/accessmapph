export type UserLevel = 'newcomer' | 'contributor' | 'trusted' | 'champion'

export interface AppUser {
  id: string
  email: string
  displayName: string
  photoURL: string | null
  points: number
  level: UserLevel
  city: string | null
  reportCount: number
  createdAt: string
}
