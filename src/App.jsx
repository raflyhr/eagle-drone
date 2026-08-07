import { useState } from 'react'
import './index.css'
import DetectionEvents from './components/Detection-Events'
import FlightHistory from './components/Flight-History'
import MapArea from './components/Map-Area'
import MissionOverview from './components/MissionOverview'
import Settings from './components/Settings'

function App() {
  const [page, setPage] = useState('mission')
  if (page === 'map') return <MapArea onNavigate={setPage} />
  if (page === 'events') return <DetectionEvents onNavigate={setPage} />
  if (page === 'history') return <FlightHistory onNavigate={setPage} />
  if (page === 'settings') return <Settings onNavigate={setPage} />
  return <MissionOverview onNavigate={setPage} />
}

export default App
