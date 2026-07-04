import { useState } from 'react'
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Folder, 
  MapPin, 
  Globe, 
  Compass,
  SlidersHorizontal,
  Info,
  Layers,
  Map,
  Plus
} from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useAuthStore } from '../../store/authStore'
import { useFilteredLocations, useLocationStatus } from '../../hooks/useFilteredLocations'
import { UserMenu } from '../auth/UserMenu'
import { FEATURE_LABELS, DISABILITY_LABELS, type FeatureType, type DisabilityType, type LocationCategory } from '../../types'
import { cn } from '../../lib/utils'

// Icons for category list
import { ShoppingBag, GraduationCap, Landmark, HeartPulse, Train, Building2 } from 'lucide-react'

const categoryIcons: Record<LocationCategory, typeof MapPin> = {
  mall: ShoppingBag,
  school: GraduationCap,
  government: Landmark,
  hospital: HeartPulse,
  transport: Train,
  other: Building2,
}

const statusColors = {
  accessible: 'bg-green-500',
  partial: 'bg-yellow-500',
  inaccessible: 'bg-red-500',
  unverified: 'bg-gray-400',
}

const spaceGradients = {
  all: 'from-[#8E5FEB] to-[#4CC9F0]',
  manila: 'from-[#C77DFF] to-[#4CC9F0]',
  cebu: 'from-[#FF9E00] to-[#E01E37]',
  davao: 'from-[#20B2AA] to-[#0077B6]',
}

export function Sidebar() {
  const activeSpace = useMapStore((s) => s.activeSpace)
  const setActiveSpace = useMapStore((s) => s.setActiveSpace)
  const selectedLocationId = useMapStore((s) => s.selectedLocationId)
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation)
  
  const featureFilters = useMapStore((s) => s.featureFilters)
  const toggleFeatureFilter = useMapStore((s) => s.toggleFeatureFilter)
  
  const disabilityFilters = useMapStore((s) => s.disabilityFilters)
  const toggleDisabilityFilter = useMapStore((s) => s.toggleDisabilityFilter)
  
  const setCommandPaletteOpen = useMapStore((s) => s.setCommandPaletteOpen)
  const clearFilters = useMapStore((s) => s.clearFilters)
  const mapTap = useMapStore((s) => s.mapTap)
  const openPinModal = useMapStore((s) => s.openPinModal)
  const requireAuth = useAuthStore((s) => s.requireAuth)

  const filteredLocations = useFilteredLocations()
  const getLocationStatus = useLocationStatus()

  // Folder collapse states
  const [isFeaturesOpen, setFeaturesOpen] = useState(true)
  const [isDisabilitiesOpen, setDisabilitiesOpen] = useState(false)
  const [isLocationsOpen, setLocationsOpen] = useState(true)

  const activeFilterCount = featureFilters.length + disabilityFilters.length

  const handleSpaceSwitch = (space: 'all' | 'manila' | 'cebu' | 'davao') => {
    setActiveSpace(space)
  }

  return (
    <aside 
      className="flex flex-col h-full w-full bg-[#1C1C1C] text-[#E8E8E8] select-none font-sans"
      aria-label="Arc Sidebar navigation"
    >
      {/* Top Header & Search bar (styled like Arc command search) */}
      <div className="p-4 shrink-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-5 h-5 rounded-full bg-gradient-to-tr flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0",
            spaceGradients[activeSpace]
          )}>
            A
          </div>
          <span className="font-display font-extrabold text-[15px] tracking-tight bg-gradient-to-r from-white to-[#E8E8E8]/70 bg-clip-text text-transparent flex-1">
            AccessMap PH
          </span>
          <UserMenu variant="dark" />
        </div>

        {/* Command bar trigger input */}
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-md cursor-pointer text-[#888888] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 min-h-[2.5rem] transition-all"
        >
          <Search size={14} className="shrink-0" />
          <span className="flex-1 truncate">Search or press ⌘K</span>
          <span className="text-[10px] bg-white/10 border border-white/5 px-1 py-0.5 rounded-sm">/</span>
        </button>
      </div>

      {/* Middle Scrollable Section (Pinned Actions & Folders) */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 scrollbar-thin">
        {/* Pinned Tabs List */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#888888] px-2 mb-2">
            Favorites
          </p>
          
          {/* Add Pin Shortcut (If user tapped map) */}
          {mapTap && (
            <button
              type="button"
              onClick={() =>
                requireAuth(openPinModal, 'Sign in to report at this spot.')
              }
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-xs font-semibold bg-primary/20 text-[#8E5FEB] hover:bg-primary/30 text-left border-0 cursor-pointer animate-pulse"
            >
              <Plus size={16} />
              <span className="truncate">Report at selected spot</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSelectedLocation(null)}
            className={cn(
              "w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-xs font-semibold text-left border-0 cursor-pointer transition-colors",
              !selectedLocationId ? "bg-white/10 text-white" : "text-[#888888] hover:bg-white/5 hover:text-white"
            )}
          >
            <Map size={15} />
            <span>Map View Overview</span>
          </button>
        </div>

        {/* Filters / Collapsible Folders */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#888888] px-2 mb-2">
            Folders
          </p>

          {/* Folder 1: Features */}
          <div>
            <button
              type="button"
              onClick={() => setFeaturesOpen(!isFeaturesOpen)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[#888888] hover:text-white hover:bg-white/5 text-left border-0 cursor-pointer"
            >
              {isFeaturesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Folder size={14} className="text-amber-500 fill-amber-500/20" />
              <span className="flex-1 truncate font-medium">Accessibility Features</span>
              {featureFilters.length > 0 && (
                <span className="text-[10px] bg-primary/20 text-[#C77DFF] font-bold px-1.5 py-0.2 rounded-full">
                  {featureFilters.length}
                </span>
              )}
            </button>
            {isFeaturesOpen && (
              <div className="pl-6 pr-2 py-1 space-y-1">
                {(Object.keys(FEATURE_LABELS) as FeatureType[]).map((f) => {
                  const isActive = featureFilters.includes(f)
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggleFeatureFilter(f)}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs border-0 cursor-pointer transition-colors",
                        isActive 
                          ? "bg-primary/20 text-white font-semibold" 
                          : "text-[#E8E8E8]/70 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span className="truncate">{FEATURE_LABELS[f]}</span>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#8E5FEB]" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Folder 2: Disabilities focus */}
          <div>
            <button
              type="button"
              onClick={() => setDisabilitiesOpen(!isDisabilitiesOpen)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[#888888] hover:text-white hover:bg-white/5 text-left border-0 cursor-pointer"
            >
              {isDisabilitiesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Folder size={14} className="text-blue-400 fill-blue-400/20" />
              <span className="flex-1 truncate font-medium">Disability Profiles</span>
              {disabilityFilters.length > 0 && (
                <span className="text-[10px] bg-primary/20 text-[#C77DFF] font-bold px-1.5 py-0.2 rounded-full">
                  {disabilityFilters.length}
                </span>
              )}
            </button>
            {isDisabilitiesOpen && (
              <div className="pl-6 pr-2 py-1 space-y-1">
                {(Object.keys(DISABILITY_LABELS) as DisabilityType[]).map((d) => {
                  const isActive = disabilityFilters.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDisabilityFilter(d)}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs border-0 cursor-pointer transition-colors",
                        isActive 
                          ? "bg-primary/20 text-white font-semibold" 
                          : "text-[#E8E8E8]/70 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span className="truncate">{DISABILITY_LABELS[d]}</span>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#8E5FEB]" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Folder 3: Locations */}
          <div className="pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setLocationsOpen(!isLocationsOpen)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[#888888] hover:text-white hover:bg-white/5 text-left border-0 cursor-pointer"
            >
              {isLocationsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Folder size={14} className="text-emerald-500 fill-emerald-500/20" />
              <span className="flex-1 truncate font-medium">Locations ({filteredLocations.length})</span>
            </button>
            {isLocationsOpen && (
              <div className="pl-3 pr-1 py-1 space-y-0.5 max-h-[220px] overflow-y-auto">
                {filteredLocations.length === 0 ? (
                  <div className="text-[11px] text-[#888888] px-2 py-3">No locations match.</div>
                ) : (
                  filteredLocations.map((loc) => {
                    const isSelected = selectedLocationId === loc.id
                    const status = getLocationStatus(loc)
                    const CategoryIcon = categoryIcons[loc.category] || MapPin
                    
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setSelectedLocation(loc.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md border-0 cursor-pointer flex gap-2 items-center transition-colors",
                          isSelected 
                            ? "bg-white/10 text-white font-medium" 
                            : "text-[#E8E8E8]/70 hover:bg-white/5 hover:text-[#E8E8E8]"
                        )}
                      >
                        <CategoryIcon size={12} className="shrink-0 text-[#888888]" />
                        <span className="flex-1 truncate text-[11px]">{loc.name}</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusColors[status])} />
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear Filters Sticky Action (surfaced if filters exist) */}
      {activeFilterCount > 0 && (
        <div className="px-4 py-2 border-t border-white/5 shrink-0 bg-[#1C1C1C]">
          <button
            type="button"
            onClick={clearFilters}
            className="w-full text-center py-1 text-[11px] font-medium text-white bg-[#8E5FEB]/20 border border-[#8E5FEB]/30 rounded-md cursor-pointer hover:bg-[#8E5FEB]/30"
          >
            Clear Filters ({activeFilterCount})
          </button>
        </div>
      )}

      {/* Bottom Area: Space Switcher (Philippines regions) */}
      <div className="p-3 shrink-0 border-t border-white/5 flex flex-col gap-2 bg-[#151515]">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888]">
            Spaces
          </span>
          <span className="text-[10px] text-[#888888]">
            {activeSpace === 'all' ? 'All PH' : activeSpace.toUpperCase()}
          </span>
        </div>

        {/* Horizontal Spaces Switcher circles (like Arc spaces bar) */}
        <div className="flex gap-2.5 justify-between px-1.5 py-1 bg-white/5 rounded-full border border-white/5">
          {/* Space 1: All Philippines */}
          <button
            type="button"
            onClick={() => handleSpaceSwitch('all')}
            className={cn(
              "w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer",
              activeSpace === 'all' 
                ? "border-white bg-gradient-to-tr from-[#8E5FEB] to-[#4CC9F0] text-white shadow-sm" 
                : "border-white/10 bg-transparent text-[#888888] hover:text-white hover:border-white/20"
            )}
            title="Space: All Regions"
          >
            <Globe size={14} />
          </button>

          {/* Space 2: Metro Manila */}
          <button
            type="button"
            onClick={() => handleSpaceSwitch('manila')}
            className={cn(
              "w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer font-bold text-xs",
              activeSpace === 'manila' 
                ? "border-white bg-gradient-to-tr from-[#C77DFF] to-[#4CC9F0] text-white shadow-sm" 
                : "border-white/10 bg-transparent text-[#888888] hover:text-white hover:border-white/20"
            )}
            title="Space: Metro Manila"
          >
            MNL
          </button>

          {/* Space 3: Cebu */}
          <button
            type="button"
            onClick={() => handleSpaceSwitch('cebu')}
            className={cn(
              "w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer font-bold text-xs",
              activeSpace === 'cebu' 
                ? "border-white bg-gradient-to-tr from-[#FF9E00] to-[#E01E37] text-white shadow-sm" 
                : "border-white/10 bg-transparent text-[#888888] hover:text-white hover:border-white/20"
            )}
            title="Space: Cebu"
          >
            CEB
          </button>

          {/* Space 4: Davao */}
          <button
            type="button"
            onClick={() => handleSpaceSwitch('davao')}
            className={cn(
              "w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer font-bold text-xs",
              activeSpace === 'davao' 
                ? "border-white bg-gradient-to-tr from-[#20B2AA] to-[#0077B6] text-white shadow-sm" 
                : "border-white/10 bg-transparent text-[#888888] hover:text-white hover:border-white/20"
            )}
            title="Space: Davao"
          >
            DVO
          </button>
        </div>
      </div>
    </aside>
  )
}
