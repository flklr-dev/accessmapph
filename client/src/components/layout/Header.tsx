import { SlidersHorizontal } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { countActiveFilters } from '../../store/selectors'
import { UserMenu } from '../auth/UserMenu'
import { LogoMark } from './LogoMark'
import { cn } from '../../lib/utils'

export function Header() {
  const featureFilters = useMapStore((s) => s.featureFilters)
  const disabilityFilters = useMapStore((s) => s.disabilityFilters)
  const showMobileFilters = useMapStore((s) => s.showMobileFilters)
  const setShowMobileFilters = useMapStore((s) => s.setShowMobileFilters)

  const activeFilterCount = countActiveFilters(featureFilters, disabilityFilters)

  return (
    <header className="md:hidden fixed top-1.5 left-1.5 right-1.5 z-header h-14 bg-canvas/95 backdrop-blur-md border-b border-border flex items-center justify-between gap-3 px-4 rounded-t-lg shadow-sm">
      <a
        href="/"
        className="flex items-center gap-2 shrink-0 no-underline hover:no-underline"
        aria-label="AccessMap PH home"
      >
        <LogoMark size={28} className="w-7 h-7" />
        <span className="text-sm font-display font-extrabold text-ink tracking-tight">
          AccessMap
        </span>
      </a>

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
