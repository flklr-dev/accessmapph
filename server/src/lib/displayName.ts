/** First name only — used on public surfaces (e.g. leaderboard) for privacy. */
export function toPublicFirstName(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return 'Contributor'
  const first = trimmed.split(/\s+/)[0]
  return first || 'Contributor'
}
