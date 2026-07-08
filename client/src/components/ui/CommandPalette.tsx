import { useEffect, useRef, useState, useId } from 'react'
import { Search, MapPin, X } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { cn } from '../../lib/utils'

interface LocationItem {
  id: string
  label: string
  subtitle: string
  action: () => void
}

export function CommandPalette() {
  const isOpen = useMapStore((s) => s.isCommandPaletteOpen)
  const setOpen = useMapStore((s) => s.setCommandPaletteOpen)
  const locations = useMapStore((s) => s.locations)
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation)

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const inputId = useId()
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) ||
        (e.target as HTMLElement).isContentEditable

      const isTrigger =
        ((e.metaKey || e.ctrlKey) &&
          (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 't')) ||
        (e.key === '/' && !isInput)

      if (isTrigger) {
        e.preventDefault()
        setOpen(!isOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setOpen])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setActiveIndex(0)
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [isOpen])

  const locationItems: LocationItem[] = locations.map((l) => ({
    id: `loc-${l.id}`,
    label: l.name,
    subtitle: `${l.address} · ${l.city}`,
    action: () => {
      setSelectedLocation(l.id)
      setOpen(false)
    },
  }))

  const searchNormalized = query.toLowerCase().trim()
  const filteredItems = searchNormalized
    ? locationItems
        .filter(
          (item) =>
            item.label.toLowerCase().includes(searchNormalized) ||
            item.subtitle.toLowerCase().includes(searchNormalized),
        )
        .slice(0, 10)
    : []

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      } else if (e.key === 'ArrowDown' && filteredItems.length > 0) {
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % filteredItems.length)
      } else if (e.key === 'ArrowUp' && filteredItems.length > 0) {
        e.preventDefault()
        setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length)
      } else if (e.key === 'Enter' && filteredItems[activeIndex]) {
        e.preventDefault()
        filteredItems[activeIndex].action()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, activeIndex, filteredItems, setOpen])

  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector('[aria-selected="true"]')
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!isOpen) return null

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
        aria-label="Search locations"
      >
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
            aria-activedescendant={
              filteredItems[activeIndex] ? filteredItems[activeIndex].id : undefined
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            placeholder="Search locations on the map…"
            className="flex-1 text-sm bg-transparent border-0 text-ink placeholder:text-gray-400 focus:outline-none min-h-10"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium bg-surface-1 border border-border rounded-sm text-ink-muted">
            ESC
          </kbd>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded-sm text-ink-muted hover:text-ink hover:bg-surface-1 cursor-pointer"
            aria-label="Close search"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="flex-1 overflow-y-auto p-2"
        >
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-muted">
              {searchNormalized
                ? 'No matching locations found.'
                : 'Type to search locations on the map.'}
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === activeIndex

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
                    isSelected ? 'bg-primary text-white' : 'bg-transparent text-ink hover:bg-canvas',
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-md shrink-0',
                      isSelected ? 'bg-white/20 text-white' : 'bg-surface-1 text-ink-muted',
                    )}
                  >
                    <MapPin size={16} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate leading-tight">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        'block text-xs truncate mt-0.5 leading-tight',
                        isSelected ? 'text-white/80' : 'text-ink-muted',
                      )}
                    >
                      {item.subtitle}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-border bg-canvas text-[11px] text-ink-muted flex justify-between items-center shrink-0">
          <div className="flex gap-3">
            <span>
              <kbd className="font-semibold bg-surface-1 border border-border px-1 py-0.5 rounded-sm mr-1">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span>
              <kbd className="font-semibold bg-surface-1 border border-border px-1 py-0.5 rounded-sm mr-1">
                Enter
              </kbd>
              Select
            </span>
          </div>
          <div>
            <span>
              Press{' '}
              <kbd className="font-semibold bg-surface-1 border border-border px-1 py-0.5 rounded-sm">
                Cmd+K
              </kbd>{' '}
              or{' '}
              <kbd className="font-semibold bg-surface-1 border border-border px-1 py-0.5 rounded-sm">
                /
              </kbd>{' '}
              to search
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
