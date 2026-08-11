import { useState } from 'react'
import useTelemetry from './hooks/useTelemetry'
import { fetchMissionDetail, formatMissionRecord } from './services/missionService'
import './index.css'
import FlightHistory from './components/Flight-History'
import FlightDetail from './components/FlightDetail'
import MapArea from './components/Map-Area'
import MissionOverview from './components/MissionOverview'
import Settings from './components/Settings'
import Sidebar from './components/Sidebar'

function App() {
  const [page, setPage] = useState(() => {
    const savedPage = localStorage.getItem('eagle_active_page') || 'mission'
    return savedPage === 'flight-detail' ? 'history' : savedPage
  })
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem('eagle_map_style') || 'standard')
  const [selectedMission, setSelectedMission] = useState(null)
  const telemetryState = useTelemetry()

  const navigate = (nextPage) => {
    setPage(nextPage)
    localStorage.setItem('eagle_active_page', nextPage)
  }

  const handleMapStyleChange = (style) => {
    setMapStyle(style)
    localStorage.setItem('eagle_map_style', style)
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa] text-[#0f172a]">
      {/* Global Unified Sidebar */}
      <Sidebar activePage={page} onNavigate={navigate} />

      {/* Pages Viewport */}
      <div className="flex-1 min-w-0">
        <div className={page === 'mission' ? 'block' : 'hidden'}>
          <MissionOverview
            onNavigate={navigate}
            telemetryState={telemetryState}
            mapStyle={mapStyle}
            onMapStyleChange={handleMapStyleChange}
          />
        </div>
        <div className={page === 'map' ? 'block' : 'hidden'}>
          <MapArea
            onNavigate={navigate}
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
            onOpenMission={async (mission) => {
              setSelectedMission(mission)
              navigate('flight-detail')
              if (mission.databaseId) {
                try {
                  const detail = await fetchMissionDetail(mission.databaseId)
                  if (detail) setSelectedMission({ ...formatMissionRecord(detail.mission), ...detail })
                } catch (error) {
                  console.warn('Mission detail unavailable:', error.message)
                }
              }
            }}
          />
        </div>
        <div className={page === 'flight-detail' ? 'block' : 'hidden'}>
          <FlightDetail mission={selectedMission} onBack={() => navigate('history')} />
        </div>
        <div className={page === 'settings' ? 'block' : 'hidden'}>
          <Settings onNavigate={navigate} telemetryState={telemetryState} />
        </div>
      </div>
    </div>
  )
}

export default App
