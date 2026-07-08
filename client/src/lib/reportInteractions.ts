/**
 * Tracks the current device's votes/flags in localStorage so the UI can
 * disable buttons the user already used, even across reloads. This is a
 * client-side UX nicety only — the server is the source of truth and
 * de-dupes by uid regardless of what the client sends.
 */

type VoteDirection = 'up' | 'down'

const VOTE_KEY = 'accessmap:report-votes'
const FLAG_KEY = 'accessmap:report-flags'

function readMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function writeMap(key: string, map: Record<string, string>) {
  try {
    localStorage.setItem(key, JSON.stringify(map))
  } catch {
    // ignore (e.g. storage disabled/full)
  }
}

export function getMyVote(reportId: string): VoteDirection | null {
  const vote = readMap(VOTE_KEY)[reportId]
  return vote === 'up' || vote === 'down' ? vote : null
}

export function setMyVote(reportId: string, direction: VoteDirection | null) {
  const map = readMap(VOTE_KEY)
  if (direction) {
    map[reportId] = direction
  } else {
    delete map[reportId]
  }
  writeMap(VOTE_KEY, map)
}

export function hasFlagged(reportId: string): boolean {
  return readMap(FLAG_KEY)[reportId] === '1'
}

export function setFlagged(reportId: string) {
  const map = readMap(FLAG_KEY)
  map[reportId] = '1'
  writeMap(FLAG_KEY, map)
}
