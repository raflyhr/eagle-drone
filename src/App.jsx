import { useState } from 'react'
import useTelemetry from './hooks/useTelemetry'
import './index.css'
import FlightHistory from './components/Flight-History'
import FlightDetail from './components/FlightDetail'
import MapArea from './components/Map-Area'
import MissionOverview from './components/MissionOverview'
import Settings from './components/Settings'
import Sidebar from './components/Sidebar'

function App() {
  const [page, setPage] = useState('mission')
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem('eagle_map_style') || 'standard')
  const [selectedMission, setSelectedMission] = useState(null)
  const telemetryState = useTelemetry()

  const handleMapStyleChange = (style) => {
    setMapStyle(style)
    localStorage.setItem('eagle_map_style', style)
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa] text-[#0f172a]">
      {/* Global Unified Sidebar */}
      <Sidebar activePage={page} onNavigate={setPage} />

      {/* Pages Viewport */}
      <div className="flex-1 min-w-0">
        <div className={page === 'mission' ? 'block' : 'hidden'}>
          <MissionOverview
            onNavigate={setPage}
            telemetryState={telemetryState}
            mapStyle={mapStyle}
            onMapStyleChange={handleMapStyleChange}
          />
        </div>
        <div className={page === 'map' ? 'block' : 'hidden'}>
          <MapArea
            onNavigate={setPage}
            telemetry={telemetryState.telemetry}
            active={page === 'map'}
            mapStyle={mapStyle}
            onMapStyleChange={handleMapStyleChange}
          />
        </div>
        <div className={page === 'history' ? 'block' : 'hidden'}>
          <FlightHistory
            missionLogs={telemetryState.missionLogs}
            currentMission={telemetryState.currentMission}
            onOpenMission={(mission) => {
              setSelectedMission(mission)
              setPage('flight-detail')
            }}
          />
        </div>
        <div className={page === 'flight-detail' ? 'block' : 'hidden'}>
          <FlightDetail mission={selectedMission} onBack={() => setPage('history')} />
        </div>
        <div className={page === 'settings' ? 'block' : 'hidden'}>
          <Settings onNavigate={setPage} telemetryState={telemetryState} />
        </div>
      </div>
    </div>
  )
}

export default App
