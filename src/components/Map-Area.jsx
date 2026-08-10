import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import useWeather from '../hooks/useWeather'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function createDroneHeadingIcon(heading = 0, size = 36) {
  const rotation = typeof heading === 'number' ? heading : 0
  const innerSize = Math.round(size * 0.7)
  return L.divIcon({
    className: 'custom-drone-heading-marker',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: ${size}px; height: ${size}px; border-radius: 50%; background: rgba(16, 185, 129, 0.2); animation: ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position: relative; width: ${innerSize}px; height: ${innerSize}px; display: flex; align-items: center; justify-content: center; transform: rotate(${rotation}deg); transition: transform 0.3s ease-out; transform-origin: center;">
          <svg viewBox="0 0 24 24" width="${innerSize}" height="${innerSize}" style="filter: drop-shadow(0px 2px 5px rgba(0,0,0,0.5));">
            <path d="M12 2L3 21L12 16.5L21 21L12 2Z" fill="#10b981" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function MapArea({ _onNavigate, telemetry, active, mapStyle = 'standard', onMapStyleChange }) {
  const weather = useWeather(telemetry.latitude, telemetry.longitude)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isLocked, setIsLocked] = useState(true)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const markerRef = useRef(null)
  const pathRef = useRef(null)
  const trailRef = useRef([])
  const baseLayerRef = useRef(null)
  const overlayLayerRef = useRef(null)

  const handleRecenter = () => {
    setIsLocked(true)
    if (leafletRef.current && telemetry.latitude && telemetry.longitude) {
      leafletRef.current.panTo([telemetry.latitude, telemetry.longitude], { animate: true })
    }
  }

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return
    const initialPos = [telemetry.latitude || -7.5950, telemetry.longitude || 110.4485]
    const map = L.map(mapRef.current, { zoomControl: false }).setView(initialPos, 14)

    // Unlock map auto-centering when user manually pans/drags the map
    map.on('dragstart', () => setIsLocked(false))
    map.on('movestart', (e) => {
      if (e.originalEvent) setIsLocked(false)
    })

    trailRef.current = [initialPos]
    pathRef.current = L.polyline(trailRef.current, {
      color: '#38bdf8',
      weight: 3,
      dashArray: '5, 5',
      opacity: 0.95,
    }).addTo(map)

    const customIcon = createDroneHeadingIcon(telemetry.heading || 0, 36)

    markerRef.current = L.marker(initialPos, { icon: customIcon }).addTo(map).bindPopup('Eagle Drone - EGL-01')
    leafletRef.current = map

    setTimeout(() => map.invalidateSize(), 50)
    setTimeout(() => map.invalidateSize(), 200)

    const ro = new ResizeObserver(() => {
      map.invalidateSize()
    })
    ro.observe(mapRef.current)

    return () => {
      ro.disconnect()
      map.remove()
      leafletRef.current = null
      markerRef.current = null
      pathRef.current = null
      baseLayerRef.current = null
      overlayLayerRef.current = null
    }
  }, [])

  // Dynamic Tile Layer Switcher
  useEffect(() => {
    if (!leafletRef.current) return
    const map = leafletRef.current

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current)
      baseLayerRef.current = null
    }
    if (overlayLayerRef.current) {
      map.removeLayer(overlayLayerRef.current)
      overlayLayerRef.current = null
    }

    if (mapStyle === 'satellite') {
      baseLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri &mdash; Satellite Imagery',
          maxZoom: 19,
        }
      ).addTo(map)

      overlayLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          opacity: 0.85,
        }
      ).addTo(map)
    } else if (mapStyle === 'terrain') {
      baseLayerRef.current = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenTopoMap contributors',
        maxZoom: 17,
      }).addTo(map)
    } else {
      // Default: 'standard' (OpenStreetMap)
      baseLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)
    }
  }, [mapStyle])

  // Invalidate Map Size when sidebar collapse toggles
  useEffect(() => {
    if (leafletRef.current) {
      const timer1 = setTimeout(() => leafletRef.current?.invalidateSize(), 50)
      const timer2 = setTimeout(() => leafletRef.current?.invalidateSize(), 320)
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
      }
    }
  }, [isSidebarCollapsed])

  useEffect(() => {
    if (!leafletRef.current || !markerRef.current) return
    const position = [telemetry.latitude, telemetry.longitude]
    markerRef.current.setLatLng(position)
    markerRef.current.setIcon(createDroneHeadingIcon(telemetry.heading || 0, 36))
    
    // Only auto-pan map when locked onto drone
    if (isLocked) {
      leafletRef.current.panTo(position, { animate: true })
    }

    const lastPos = trailRef.current[trailRef.current.length - 1]
    if (!lastPos || Math.abs(lastPos[0] - position[0]) > 0.00001 || Math.abs(lastPos[1] - position[1]) > 0.00001) {
      trailRef.current.push(position)
      if (trailRef.current.length > 2000) {
        trailRef.current.splice(1, 1) // preserve index 0 (initial takeoff point)
      }
    }
    if (pathRef.current) {
      pathRef.current.setLatLngs(trailRef.current)
    }
  }, [telemetry.latitude, telemetry.longitude, telemetry.heading, isLocked])

  useEffect(() => {
    if (active && leafletRef.current) {
      setTimeout(() => leafletRef.current?.invalidateSize(), 0)
      setTimeout(() => leafletRef.current?.invalidateSize(), 150)
    }
  }, [active])

  return (
    <main className="ml-[72px] flex-1 flex flex-col min-h-screen bg-[#f5f7fa] text-[#0f172a]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#eef2f6] bg-white px-6">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Map & Search Area</h2>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row min-h-0">
          {/* Map Area */}
          <div className="relative flex-1 min-h-[450px]">
            <div ref={mapRef} className="absolute inset-0" />
            
            {/* Top Floating Telemetry Badges */}
            <div className="absolute left-6 top-6 z-[400] flex flex-wrap gap-2.5">
              <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md border border-slate-200">
                <Icon className="text-emerald-600 text-[16px]">near_me</Icon>
                <span className="text-slate-500 font-medium">UAV:</span>
                <span className="data-font font-bold text-slate-900">{telemetry.latitude.toFixed(4)}, {telemetry.longitude.toFixed(4)}</span>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md border border-slate-200">
                <Icon className="text-indigo-600 text-[16px]">radar</Icon>
                <span className="text-slate-500 font-medium">Sector:</span>
                <span className="font-bold text-slate-900 truncate max-w-[220px]">{weather.sector} ({weather.locationName})</span>
              </div>
            </div>

            {/* Top Right Controls Container (Recenter Button + Map Style Selector + Panel Data Button) */}
            <div className="absolute top-6 right-6 z-[400] flex items-center gap-2">
              {/* Recenter Drone Position Button (Logo Only, No Text, No Lock Icon) */}
              <button
                type="button"
                onClick={handleRecenter}
                className={`flex items-center justify-center w-9 h-9 rounded-lg shadow-md border transition cursor-pointer ${
                  isLocked
                    ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 active:scale-95'
                }`}
                title={isLocked ? 'Peta Terkunci di Posisi Drone' : 'Kembali Posisikan Peta ke Drone'}
              >
                <Icon className="text-[20px]">{isLocked ? 'my_location' : 'location_searching'}</Icon>
              </button>

              {/* Map Style Selector */}
              <div className="flex items-center rounded-lg bg-white p-1 shadow-md border border-slate-200">
                <button
                  type="button"
                  onClick={() => onMapStyleChange?.('standard')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    mapStyle === 'standard'
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Peta Jalan Standard (OpenStreetMap)"
                >
                  Standard
                </button>

                <button
                  type="button"
                  onClick={() => onMapStyleChange?.('satellite')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    mapStyle === 'satellite'
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Peta Satelit Hybrid"
                >
                  Satelit
                </button>

                <button
                  type="button"
                  onClick={() => onMapStyleChange?.('terrain')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    mapStyle === 'terrain'
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Peta Topografi & Kontur Altitude"
                >
                  Topografi
                </button>
              </div>

              {/* Expand Sidebar Trigger Button positioned to the RIGHT of Style Selector */}
              {isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md border border-slate-200 hover:bg-slate-900 hover:text-white transition cursor-pointer"
                  title="Buka Panel Informasi"
                >
                  <Icon className="text-[16px]">chevron_left</Icon>
                  <span>Panel Data</span>
                </button>
              )}
            </div>

            {/* Zoom In / Zoom Out Controls */}
            <div className="absolute bottom-6 right-6 z-[400] flex flex-col rounded-lg bg-white shadow-md border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => leafletRef.current?.zoomIn()}
                className="flex items-center justify-center w-9 h-9 text-slate-700 hover:bg-slate-900 hover:text-white border-b border-slate-200 transition cursor-pointer active:scale-95"
                title="Zoom In (+)"
              >
                <Icon className="text-[20px]">add</Icon>
              </button>
              <button
                type="button"
                onClick={() => leafletRef.current?.zoomOut()}
                className="flex items-center justify-center w-9 h-9 text-slate-700 hover:bg-slate-900 hover:text-white transition cursor-pointer active:scale-95"
                title="Zoom Out (-)"
              >
                <Icon className="text-[20px]">remove</Icon>
              </button>
            </div>

            {/* Map Source Info Badge */}
            <div className="absolute bottom-6 left-6 z-[400] rounded-lg bg-white px-3 py-1.5 text-xs text-slate-700 shadow-md border border-slate-200 font-medium">
              <span className="text-slate-500">Peta: </span>
              <span className="font-bold text-slate-900">
                {mapStyle === 'satellite'
                  ? 'Esri Satelit Hybrid'
                  : mapStyle === 'terrain'
                  ? 'OpenTopoMap'
                  : 'OpenStreetMap'}
              </span>
            </div>
          </div>

          {/* Right Sidebar: Waypoints & Environment (Collapsible/Minimizable) */}
          <aside
            className={`border-t lg:border-t-0 lg:border-l border-[#eef2f6] bg-white transition-all duration-300 ease-in-out overflow-y-auto ${
              isSidebarCollapsed
                ? 'w-0 border-0 p-0 hidden lg:hidden'
                : 'w-full lg:w-96 p-6 flex flex-col gap-6'
            }`}
          >
            {/* Sidebar Minimize Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Icon className="text-[20px] text-slate-700">space_dashboard</Icon>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Mission Panel</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 px-3 py-1.5 text-xs font-bold transition border border-slate-200 shadow-xs cursor-pointer"
                title="Sembunyikan Panel"
              >
                <span>Sembunyikan</span>
                <Icon className="text-[16px]">chevron_right</Icon>
              </button>
            </div>

            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                <Icon className="text-slate-600">route</Icon>
                Active Waypoints
              </h3>
              <div className="space-y-2.5">
                {[
                  { no: '1', title: 'Alpha Ridge Base', meta: 'Cleared - 14:02', done: true },
                  { no: '2', title: 'Sector Center Target', meta: 'En Route - ETA 2m', active: true },
                  { no: '3', title: 'Ravine Echo', meta: 'Pending', pending: true },
                ].map((wp) => (
                  <div
                    key={wp.no}
                    className={`flex items-center gap-3.5 rounded-xl p-3 border transition ${
                      wp.active
                        ? 'border-indigo-100 bg-indigo-50/50 shadow-sm'
                        : 'border-slate-100 bg-[#f8fafc]'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                        wp.active
                          ? 'bg-indigo-600 text-white'
                          : wp.done
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {wp.no}
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs font-bold ${wp.active ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {wp.title}
                      </p>
                      <p className="text-[11px] text-slate-400">{wp.meta}</p>
                    </div>
                    <Icon className={`text-[18px] ${wp.done ? 'text-emerald-600' : wp.active ? 'animate-spin text-indigo-600' : 'text-slate-300'}`}>
                      {wp.done ? 'check_circle' : wp.active ? 'sync' : 'schedule'}
                    </Icon>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                <Icon className="text-slate-600">analytics</Icon>
                Environment
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Wind Speed', `${weather.windSpeed} m/s`],
                  ['Humidity', `${weather.humidity}%`],
                  ['Temp', `${weather.temperature} °C`],
                  ['Signal Link', `${telemetry.signal || 98}%`],
                ].map(([label, value]) => (
                  <div key={label} className="bento-subcard p-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                    <p className="data-font text-base font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
  )
}
