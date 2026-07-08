import { useMapStore } from './store/mapStore'
import { useLocations } from './hooks/useLocations'
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import { Header } from './components/layout/Header'
import { AuthModal } from './components/auth/AuthModal'
import { ProfileModal } from './components/auth/ProfileModal'
import { LeaderboardModal } from './components/leaderboard/LeaderboardModal'
import { Sidebar } from './components/layout/Sidebar'
import { MobilePanel } from './components/layout/MobilePanel'
import { MapView } from './components/map/MapView'
import { ReportFormModal } from './components/reports/ReportFormModal'
import { FindPlaceModal } from './components/reports/FindPlaceModal'
import { LocationConfirmModal } from './components/reports/LocationConfirmModal'
import { PinConfirmModal } from './components/map/PinConfirmModal'
import { ToastContainer } from './components/ui/Toast'
import { CommandPalette } from './components/ui/CommandPalette'
import { LocationPanel } from './components/layout/LocationPanel'

const spaceGradients = {
  all: 'from-[#8E5FEB] to-[#4CC9F0]',
  manila: 'from-[#C77DFF] to-[#4CC9F0]',
  cebu: 'from-[#FF9E00] to-[#E01E37]',
  davao: 'from-[#20B2AA] to-[#0077B6]',
}

export default function App() {
  useAuthBootstrap()
  useLocations()
  const activeSpace = useMapStore((s) => s.activeSpace)
  const selectedLocationId = useMapStore((s) => s.selectedLocationId)
  const locations = useMapStore((s) => s.locations)

  const selectedLocation = locations.find((l) => l.id === selectedLocationId)

  return (
    <div className={`h-dvh w-screen p-1.5 md:p-2.5 bg-gradient-to-br ${spaceGradients[activeSpace]} flex flex-col overflow-hidden transition-all duration-300`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Main Window Frame */}
      <div className="flex-1 flex flex-row min-h-0 bg-[#1C1C1C] rounded-lg md:rounded-xl overflow-hidden relative shadow-elevated">
        {/* Desktop Sidebar (Arc Browser Vertical Sidebar) */}
        <div className="hidden md:flex w-[280px] shrink-0 h-full border-r border-border/10">
          <Sidebar />
        </div>

        {/* Content Pane (Arc Browser Web Page Pane) */}
        <div className="flex-1 bg-[#FAFAF8] rounded-lg md:rounded-r-xl md:rounded-l-none overflow-hidden flex flex-col relative min-h-0 border border-border/10">
          {/* Mobile Header (Hidden on Desktop) */}
          <Header />

          {/* Main workspace layout */}
          <main
            id="main-content"
            className="flex-1 flex flex-row min-h-0 relative pt-14 md:pt-0"
          >
            {/* Map — must have explicit height for Leaflet */}
            <div className="flex-1 relative min-h-0 h-full pb-[3.25rem] md:pb-0">
              <MapView />
            </div>

            {/* Desktop Easel (Split-panel details drawer) */}
            {selectedLocation && (
              <div 
                className="hidden md:flex flex-col w-[380px] shrink-0 border-l border-border bg-[#FAFAF8] h-full shadow-sidebar animate-in slide-in-from-right duration-220 ease-[cubic-bezier(0.16,1,0.3,1)] z-10 overflow-hidden"
                role="complementary"
                aria-label="Location detail panel"
              >
                <div className="flex-1 overflow-y-auto">
                  <LocationPanel showHeader={false} />
                </div>
              </div>
            )}
          </main>

          {/* Mobile bottom sheet drawer */}
          <MobilePanel />
        </div>
      </div>

      <CommandPalette />
      <AuthModal />
      <ProfileModal />
      <LeaderboardModal />
      <FindPlaceModal />
      <LocationConfirmModal />
      <ReportFormModal />
      <PinConfirmModal />
      <ToastContainer />
    </div>
  )
}

