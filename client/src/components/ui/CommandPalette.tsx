import { useEffect, useRef, useState, useId } from 'react'
import { Search, MapPin, Compass, Layers, Check, X } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useFilteredLocations } from '../../hooks/useFilteredLocations'
import { FEATURE_LABELS, DISABILITY_LABELS, type FeatureType, type DisabilityType } from '../../types'
import { cn } from '../../lib/utils'

interface CommandItem {
  id: string
  type: 'location' | 'space' | 'filter-feature' | 'filter-disability' | 'action'
  label: string
  subtitle?: string
  action: () => void
  checked?: boolean
}

export function CommandPalette() {
  const isOpen = useMapStore((s) => s.isCommandPaletteOpen)
  const setOpen = useMapStore((s) => s.setCommandPaletteOpen)
  const setFindPlaceModalOpen = useMapStore((s) => s.setFindPlaceModalOpen)
  const locations = useMapStore((s) => s.locations)
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation)
  const activeSpace = useMapStore((s) => s.activeSpace)
  const setActiveSpace = useMapStore((s) => s.setActiveSpace)
  const featureFilters = useMapStore((s) => s.featureFilters)
  const toggleFeatureFilter = useMapStore((s) => s.toggleFeatureFilter)
  const disabilityFilters = useMapStore((s) => s.disabilityFilters)
  const toggleDisabilityFilter = useMapStore((s) => s.toggleDisabilityFilter)
  const clearFilters = useMapStore((s) => s.clearFilters)

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const inputId = useId()
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Open / Close with keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K or Cmd/Ctrl + T or '/' when not in input/textarea
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable
      
      const isTrigger = 
        ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 't')) ||
        (e.key === '/' && !isInput)

      if (isTrigger) {
        e.preventDefault()
        setOpen(!isOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setOpen])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      // Slight delay to ensure element is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Keyboard navigation within palette
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % filteredItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[activeIndex]) {
          filteredItems[activeIndex].action()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, activeIndex, query])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector('[aria-selected="true"]')
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  if (!isOpen) return null

  // Spaces items
  const spaceItems: CommandItem[] = [
    {
      id: 'space-all',
      type: 'space',
      label: 'Switch to Space: All Regions',
      subtitle: 'Show all locations in the Philippines',
      checked: activeSpace === 'all',
      action: () => {
        setActiveSpace('all')
        setOpen(false)
      }
    },
    {
      id: 'space-manila',
      type: 'space',
      label: 'Switch to Space: Metro Manila',
      subtitle: 'Zoom map to Pasay & Manila City centers',
      checked: activeSpace === 'manila',
      action: () => {
        setActiveSpace('manila')
        setOpen(false)
      }
    },
    {
      id: 'space-cebu',
      type: 'space',
      label: 'Switch to Space: Cebu City',
      subtitle: 'Zoom map to Cebu Island centers',
      checked: activeSpace === 'cebu',
      action: () => {
        setActiveSpace('cebu')
        setOpen(false)
      }
    },
    {
      id: 'space-davao',
      type: 'space',
      label: 'Switch to Space: Davao City',
      subtitle: 'Zoom map to Davao Mindanao centers',
      checked: activeSpace === 'davao',
      action: () => {
        setActiveSpace('davao')
        setOpen(false)
      }
    }
  ]

  // Feature filters
  const featureFilterItems = (Object.keys(FEATURE_LABELS) as FeatureType[]).map((f) => ({
    id: `filter-feat-${f}`,
    type: 'filter-feature' as const,
    label: `Toggle Filter: ${FEATURE_LABELS[f]}`,
    subtitle: 'Filter map locations by this accessibility feature',
    checked: featureFilters.includes(f),
    action: () => {
      toggleFeatureFilter(f)
    }
  }))

  // Disability filters
  const disabilityFilterItems = (Object.keys(DISABILITY_LABELS) as DisabilityType[]).map((d) => ({
    id: `filter-dis-${d}`,
    type: 'filter-disability' as const,
    label: `Toggle Focus: ${DISABILITY_LABELS[d]} accessibility`,
    subtitle: 'Filter map locations by this disability profile',
    checked: disabilityFilters.includes(d),
    action: () => {
      toggleDisabilityFilter(d)
    }
  }))

  // Clear filters action
  const actionItems: CommandItem[] = [
    {
      id: 'action-find-place',
      type: 'action',
      label: 'Find a place to report',
      subtitle: 'Search by name — recommended way to add a report',
      action: () => {
        setFindPlaceModalOpen(true)
        setOpen(false)
      },
    },
  ]
  if (featureFilters.length > 0 || disabilityFilters.length > 0) {
    actionItems.push({
      id: 'action-clear',
      type: 'action',
      label: 'Clear all active filters',
      subtitle: `Resetting ${featureFilters.length + disabilityFilters.length} toggled options`,
      action: () => {
        clearFilters()
      }
    })
  }

  // Location items
  const locationItems = locations.map((l) => ({
    id: `loc-${l.id}`,
    type: 'location' as const,
    label: l.name,
    subtitle: `${l.address} · ${l.city}`,
    action: () => {
      setSelectedLocation(l.id)
      setOpen(false)
    }
  }))

  // Combined list
  const allItems: CommandItem[] = [
    ...spaceItems,
    ...actionItems,
    ...featureFilterItems,
    ...disabilityFilterItems,
    ...locationItems
  ]

  // Filter combined list by text query
  const searchNormalized = query.toLowerCase().trim()
  const filteredItems = allItems.filter((item) => {
    if (!searchNormalized) {
      // In default view, only show spaces, active filters, actions, and first 3 locations
      return item.type === 'space' || item.type === 'action' || item.checked || item.id === 'loc-loc-1' || item.id === 'loc-loc-2'
    }
    return (
      item.label.toLowerCase().includes(searchNormalized) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(searchNormalized))
    )
  }).slice(0, 10) // Limit to 10 results for search speed and display limits

  return (
    <div
      className="fixed inset-0 z-toast grid place-items-start justify-items-center p-4 bg-black/40 backdrop-blur-xs transition-opacity duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div
        ref={containerRef}
        className="w-full max-w-xl bg-white border border-border rounded-lg shadow-elevated overflow-hidden mt-[12vh] flex flex-col max-h-[70vh] transition-transform duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Command bar"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-canvas">
          <Search size={18} className="text-ink-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={filteredItems[activeIndex] ? filteredItems[activeIndex].id : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            placeholder="Type to search locations, features, or spaces..."
            className="flex-1 text-sm bg-transparent border-0 text-ink placeholder:text-gray-400 focus:outline-none min-h-[2.5rem]"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium bg-surface-1 border border-border rounded-sm text-ink-muted">
            ESC
          </kbd>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded-sm text-ink-muted hover:text-ink hover:bg-surface-1 cursor-pointer"
            aria-label="Close command palette"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="flex-1 overflow-y-auto p-2 divide-y divide-gray-50/50"
        >
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-muted">
              No matching actions or locations found.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === activeIndex
              
              let Icon = Compass
              if (item.type === 'location') Icon = MapPin
              if (item.type === 'filter-feature' || item.type === 'filter-disability') Icon = Layers

              return (
                <button
                  key={item.id}
                  id={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={item.action}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 transition-colors border-0 cursor-pointer',
                    isSelected ? 'bg-primary text-white' : 'bg-transparent text-ink hover:bg-canvas'
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-md shrink-0',
                    isSelected ? 'bg-white/20 text-white' : 'bg-surface-1 text-ink-muted'
                  )}>
                    <Icon size={16} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate leading-tight">
                      {item.label}
                    </span>
                    {item.subtitle && (
                      <span className={cn(
                        'block text-xs truncate mt-0.5 leading-tight',
                        isSelected ? 'text-white/80' : 'text-ink-muted'
                      )}>
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                  {item.checked && (
                    <Check size={16} className={isSelected ? 'text-white' : 'text-primary'} aria-hidden="true" />
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 border-t border-border bg-canvas text-[11px] text-ink-muted flex justify-between items-center shrink-0">
          <div className="flex gap-3">
            <span>
              <kbd className="font-semibold bg-surface-1 border border-border px-1 py-0.5 rounded-sm mr-1">↑↓</kbd>
              Navigate
            </span>
            <span>
              <kbd className="font-semibold bg-surface-1 border border-border px-1 py-0.5 rounded-sm mr-1">Enter</kbd>
              Select
            </span>
          </div>
          <div>
            <span>Press <kbd className="font-semibold bg-surface-1 border border-border px-1 py-0.5 rounded-sm">Cmd+K</kbd> or <kbd className="font-semibold bg-surface-1 border border-border px-1 py-0.5 rounded-sm">/</kbd> to invoke</span>
          </div>
        </div>
      </div>
    </div>
  )
}
