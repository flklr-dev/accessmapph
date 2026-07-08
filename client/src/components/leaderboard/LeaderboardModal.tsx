import { useEffect, useState } from 'react'
import { Loader2, Medal, Trophy } from 'lucide-react'
import { fetchLeaderboard } from '../../api/leaderboard'
import { useAuthStore } from '../../store/authStore'
import { useMapStore } from '../../store/mapStore'
import { toPublicFirstName } from '../../lib/displayName'
import { LEVEL_LABELS } from '../../types/auth'
import {
  LEADERBOARD_CITY_OPTIONS,
  type LeaderboardCity,
  type LeaderboardEntry,
  type LeaderboardResult,
} from '../../types/leaderboard'
import { Modal } from '../ui/Modal'
import { EmptyState } from '../ui/EmptyState'
import { cn } from '../../lib/utils'

function rankAccent(rank: number) {
  if (rank === 1) return 'bg-yellow-50 text-yellow-600 border-yellow-500/20'
  if (rank === 2) return 'bg-surface-1 text-ink-muted border-border'
  if (rank === 3) return 'bg-[#F0845A]/10 text-[#a05c00] border-[#F0845A]/25'
  return 'bg-white text-ink-muted border-border'
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-md border text-xs font-bold shrink-0',
          rankAccent(rank),
        )}
        aria-label={`Rank ${rank}`}
      >
        <Medal size={14} aria-hidden="true" />
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-white text-xs font-bold text-ink-muted shrink-0"
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  )
}

function EntryRow({
  entry,
  isYou,
  city,
}: {
  entry: LeaderboardEntry
  isYou: boolean
  city: LeaderboardCity
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors',
        isYou
          ? 'border-primary/40 bg-blue-50'
          : 'border-border bg-white',
      )}
    >
      <RankBadge rank={entry.rank} />

      <div className="w-9 h-9 rounded-md border border-border overflow-hidden shrink-0 bg-surface-1 flex items-center justify-center">
        {entry.photoURL ? (
          <img
            src={entry.photoURL}
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="text-xs font-bold text-primary">
            {toPublicFirstName(entry.displayName).slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink m-0 truncate">
          {toPublicFirstName(entry.displayName)}
          {isYou && (
            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              You
            </span>
          )}
        </p>
        <p className="text-[11px] text-ink-muted m-0 mt-0.5">
          {LEVEL_LABELS[entry.level]}
          {city === 'all'
            ? ` · ${entry.reportCount} report${entry.reportCount === 1 ? '' : 's'}`
            : ` · ${entry.cityReports} in city · ${entry.reportCount} total`}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-ink m-0 tabular-nums">{entry.points}</p>
        <p className="text-[10px] text-ink-muted m-0 uppercase tracking-wide">pts</p>
      </div>
    </li>
  )
}

export function LeaderboardModal() {
  const isOpen = useMapStore((s) => s.isLeaderboardOpen)
  const closeLeaderboard = useMapStore((s) => s.closeLeaderboard)
  const activeSpace = useMapStore((s) => s.activeSpace)
  const profile = useAuthStore((s) => s.profile)

  const [city, setCity] = useState<LeaderboardCity>('all')
  const [data, setData] = useState<LeaderboardResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default tab to the map space the user is currently browsing.
  useEffect(() => {
    if (!isOpen) return
    setCity(activeSpace)
  }, [isOpen, activeSpace])

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchLeaderboard(city)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load leaderboard.')
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, city])

  return (
    <Modal open={isOpen} onClose={closeLeaderboard} title="Leaderboard" className="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 px-3.5 py-3 rounded-md bg-surface-1 border border-border">
          <Trophy size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink m-0">Top contributors</p>
            <p className="text-[13px] leading-relaxed text-ink-muted m-0 mt-1">
              Ranked by points nationwide, or by reports in each city. Flagged reports do not
              count.
            </p>
          </div>
        </div>

        <div
          className="flex gap-1 p-1 rounded-md bg-surface-1 border border-border"
          role="tablist"
          aria-label="Leaderboard city"
        >
          {LEADERBOARD_CITY_OPTIONS.map((option) => {
            const selected = city === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setCity(option.id)}
                className={cn(
                  'flex-1 min-h-9 px-2 rounded-sm text-xs font-semibold border-0 cursor-pointer transition-colors',
                  selected
                    ? 'bg-white text-ink shadow-card'
                    : 'bg-transparent text-ink-muted hover:text-ink',
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted"
            role="status"
          >
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Loading rankings…
          </div>
        ) : error ? (
          <p
            className="text-sm text-red-500 m-0 leading-relaxed px-3 py-2.5 rounded-md bg-red-50 border border-red-500/20"
            role="alert"
          >
            {error}
          </p>
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            title="No contributors yet"
            description={
              city === 'all'
                ? 'Submit accessibility reports to appear on the leaderboard.'
                : `No reports in ${data?.cityLabel ?? 'this city'} yet. Be the first to contribute.`
            }
          />
        ) : (
          <>
            <p className="text-xs text-ink-muted m-0">
              {data.totalContributors} contributor
              {data.totalContributors === 1 ? '' : 's'}
              {city === 'all' ? ' nationwide' : ` in ${data.cityLabel}`}
            </p>
            <ol className="m-0 p-0 list-none space-y-2 max-h-[46vh] overflow-y-auto">
              {data.entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  isYou={profile?.id === entry.id}
                  city={city}
                />
              ))}
            </ol>
          </>
        )}
      </div>
    </Modal>
  )
}
