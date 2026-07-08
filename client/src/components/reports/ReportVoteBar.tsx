import { useState } from 'react'
import { Flag, ThumbsDown, ThumbsUp } from 'lucide-react'
import { flagReport, voteOnReport } from '../../api/reports'
import { useAuthStore } from '../../store/authStore'
import { useMapStore } from '../../store/mapStore'
import { getMyVote, hasFlagged, setFlagged, setMyVote } from '../../lib/reportInteractions'
import type { Report } from '../../types'
import { cn } from '../../lib/utils'

interface ReportVoteBarProps {
  locationId: string
  report: Report
}

/**
 * Tier 3 community moderation controls: confirm/dispute a report or flag it
 * as spam. Free — no AI involved. Thresholds on the server decide when a
 * report becomes "Verified" or gets hidden as flagged.
 */
export function ReportVoteBar({ locationId, report }: ReportVoteBarProps) {
  const requireAuth = useAuthStore((s) => s.requireAuth)
  const myReportIds = useAuthStore((s) => s.myReportIds)
  const replaceReport = useMapStore((s) => s.replaceReport)
  const showToast = useMapStore((s) => s.showToast)

  const [busy, setBusy] = useState<'up' | 'down' | 'flag' | null>(null)
  const [myVote, setMyVoteState] = useState(() => getMyVote(report.id))
  const [flagged, setFlaggedState] = useState(() => hasFlagged(report.id))

  const isOwnReport = myReportIds.has(report.id)

  const handleVote = (direction: 'up' | 'down') => {
    if (busy || isOwnReport || flagged) return

    requireAuth(async () => {
      setBusy(direction)
      try {
        const updated = await voteOnReport(locationId, report.id, direction)
        replaceReport(locationId, updated)
        const nextVote = myVote === direction ? null : direction
        setMyVote(report.id, nextVote)
        setMyVoteState(nextVote)
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not register vote.', 'error')
      } finally {
        setBusy(null)
      }
    }, 'Sign in to confirm or dispute this report.')
  }

  const handleFlag = () => {
    if (busy || isOwnReport || flagged) return

    requireAuth(async () => {
      setBusy('flag')
      try {
        const updated = await flagReport(locationId, report.id)
        replaceReport(locationId, updated)
        setFlagged(report.id)
        setFlaggedState(true)
        showToast('Thanks — this report was flagged for review.', 'info')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not flag report.', 'error')
      } finally {
        setBusy(null)
      }
    }, 'Sign in to flag this report.')
  }

  if (isOwnReport) {
    return (
      <div className="flex items-center gap-3 mt-2 -ml-1.5">
        <span className="inline-flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-gray-400">
          <ThumbsUp size={13} aria-hidden="true" />
          {report.upvotes}
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-gray-400">
          <ThumbsDown size={13} aria-hidden="true" />
          {report.downvotes}
        </span>
        <p className="text-[10px] text-gray-400 m-0 italic">
          This is your report — the community can confirm or flag it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 mt-2 -ml-1.5">
      <button
        type="button"
        onClick={() => handleVote('up')}
        disabled={busy !== null || flagged}
        aria-pressed={myVote === 'up'}
        title="Confirm this report"
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-1 rounded-sm text-xs font-medium cursor-pointer border-0 bg-transparent transition-colors',
          myVote === 'up' ? 'text-green-600' : 'text-gray-400 hover:text-ink hover:bg-surface-1',
          (busy !== null || flagged) && 'opacity-50 cursor-not-allowed',
        )}
      >
        <ThumbsUp size={13} aria-hidden="true" />
        {report.upvotes}
      </button>

      <button
        type="button"
        onClick={() => handleVote('down')}
        disabled={busy !== null || flagged}
        aria-pressed={myVote === 'down'}
        title="Dispute this report"
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-1 rounded-sm text-xs font-medium cursor-pointer border-0 bg-transparent transition-colors',
          myVote === 'down' ? 'text-red-500' : 'text-gray-400 hover:text-ink hover:bg-surface-1',
          (busy !== null || flagged) && 'opacity-50 cursor-not-allowed',
        )}
      >
        <ThumbsDown size={13} aria-hidden="true" />
        {report.downvotes}
      </button>

      <button
        type="button"
        onClick={handleFlag}
        disabled={busy !== null || flagged}
        title={flagged ? 'You flagged this report' : 'Flag as spam or inaccurate'}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-1 rounded-sm text-xs font-medium cursor-pointer border-0 bg-transparent transition-colors ml-auto',
          flagged ? 'text-red-500' : 'text-gray-400 hover:text-red-500 hover:bg-surface-1',
          busy !== null && 'opacity-50 cursor-not-allowed',
        )}
      >
        <Flag size={13} aria-hidden="true" />
        {flagged ? 'Flagged' : 'Flag'}
      </button>
    </div>
  )
}
