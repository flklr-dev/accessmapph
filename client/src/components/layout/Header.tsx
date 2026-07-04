import { SlidersHorizontal, Search } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { countActiveFilters } from '../../store/selectors'
import { UserMenu } from '../auth/UserMenu'
import { cn } from '../../lib/utils'

export function Header() {
  const featureFilters = useMapStore((s) => s.featureFilters)
  const disabilityFilters = useMapStore((s) => s.disabilityFilters)
  const showMobileFilters = useMapStore((s) => s.showMobileFilters)
  const setShowMobileFilters = useMapStore((s) => s.setShowMobileFilters)
  const setCommandPaletteOpen = useMapStore((s) => s.setCommandPaletteOpen)
  const activeSpace = useMapStore((s) => s.activeSpace)

  const activeFilterCount = countActiveFilters(featureFilters, disabilityFilters)

  const spaceNames = {
    all: 'All Regions',
    manila: 'Metro Manila',
    cebu: 'Cebu City',
    davao: 'Davao City',
  }

  return (
    <header className="md:hidden fixed top-1.5 left-1.5 right-1.5 z-header h-14 bg-canvas/95 backdrop-blur-md border-b border-border flex items-center justify-between gap-3 px-4 rounded-t-lg shadow-sm">
      <a
        href="/"
        className="flex items-center gap-2 shrink-0 no-underline hover:no-underline"
        aria-label="AccessMap PH home"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[#8E5FEB]/10">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="15" r="9" stroke="#8E5FEB" strokeWidth="2.5" fill="none" />
            <circle cx="16" cy="15" r="3" fill="#F0845A" />
          </svg>
        </div>
        <span className="text-sm font-display font-extrabold text-ink tracking-tight">
          AccessMap
        </span>
      </a>

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className="flex-1 max-w-[160px] xs:max-w-xs flex items-center gap-2 px-3 py-1.5 text-left text-xs bg-surface-1 border border-border rounded-md text-ink-muted hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary min-h-9 cursor-pointer"
      >
        <Search size={13} className="text-gray-400 shrink-0" />
        <span className="truncate flex-1">Search {spaceNames[activeSpace]}...</span>
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className={cn(
            'relative inline-flex items-center justify-center w-10 h-10 rounded-md border border-border bg-white text-text-muted hover:bg-gray-50 hover:text-text cursor-pointer',
            activeFilterCount > 0 && 'border-primary',
          )}
          aria-label={`Filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
          aria-pressed={showMobileFilters}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-primary rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        <UserMenu variant="light" />
      </div>
    </header>
  )
}
