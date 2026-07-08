/** First name only — matches server redaction for leaderboard display. */
export function toPublicFirstName(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return 'Contributor'
  const first = trimmed.split(/\s+/)[0]
  return first || 'Contributor'
}
