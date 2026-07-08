import { Trophy } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

/** Floating map control (top-left) — the single entry point to the leaderboard. */
export function MapLeaderboardButton() {
  const openLeaderboard = useMapStore((s) => s.openLeaderboard)

  return (
    <button
      type="button"
      onClick={openLeaderboard}
      className="absolute top-3 left-3 z-map inline-flex items-center justify-center w-11 h-11 glass-panel-interactive rounded-md cursor-pointer text-ink-muted hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label="Open leaderboard"
      title="Leaderboard"
    >
      <Trophy size={18} aria-hidden="true" />
    </button>
  )
}
