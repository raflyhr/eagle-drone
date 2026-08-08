import { useState } from 'react'
import useTelemetry from './hooks/useTelemetry'
import './index.css'
import DetectionEvents from './components/Detection-Events'
import FlightHistory from './components/Flight-History'
import MapArea from './components/Map-Area'
import MissionOverview from './components/MissionOverview'
import Settings from './components/Settings'

function App() {
  const [page, setPage] = useState('mission')
  const telemetry = useTelemetry()

  return (
    <>
      <div className={page === 'mission' ? 'block' : 'hidden'}>
        <MissionOverview onNavigate={setPage} telemetry={telemetry} />
      </div>
      <div className={page === 'map' ? 'block' : 'hidden'}>
        <MapArea onNavigate={setPage} telemetry={telemetry} active={page === 'map'} />
      </div>
      <div className={page === 'events' ? 'block' : 'hidden'}>
        <DetectionEvents onNavigate={setPage} />
      </div>
      <div className={page === 'history' ? 'block' : 'hidden'}>
        <FlightHistory onNavigate={setPage} />
      </div>
      <div className={page === 'settings' ? 'block' : 'hidden'}>
        <Settings onNavigate={setPage} />
      </div>
    </>
  )
}

export default App
