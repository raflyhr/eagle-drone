import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import useWeather from '../hooks/useWeather'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

export default function MapArea({ _onNavigate, telemetry, active, mapStyle = 'standard', onMapStyleChange }) {
  const weather = useWeather(telemetry.latitude, telemetry.longitude)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const markerRef = useRef(null)
  const pathRef = useRef(null)
  const trailRef = useRef([])
  const baseLayerRef = useRef(null)
  const overlayLayerRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return
    const initialPos = [telemetry.latitude || -6.2, telemetry.longitude || 106.816666]
    const map = L.map(mapRef.current, { zoomControl: false }).setView(initialPos, 14)

    trailRef.current = [initialPos]
    pathRef.current = L.polyline(trailRef.current, {
      color: '#38bdf8',
      weight: 3,
      dashArray: '5, 5',
      opacity: 0.95,
    }).addTo(map)

    const customIcon = L.divIcon({
      className: 'custom-drone-marker',
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background: rgba(16, 185, 129, 0.25); animation: ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width: 16px; height: 16px; border-radius: 50%; background: #0f172a; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
            <div style="width: 5px; height: 5px; border-radius: 50%; background: #10b981;"></div>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    })

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
    leafletRef.current.panTo(position, { animate: true })

    trailRef.current.push(position)
    if (trailRef.current.length > 30) trailRef.current.shift()
    if (pathRef.current) {
      pathRef.current.setLatLngs(trailRef.current)
    }
  }, [telemetry.latitude, telemetry.longitude])

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
            
            {/* Top Floating Telemetry Pills */}
            <div className="absolute left-6 top-6 z-[400] flex flex-wrap gap-3">
              <div className="flex items-center gap-2.5 rounded-xl bg-white/95 px-3.5 py-2 text-xs font-semibold text-slate-800 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/80">
                <Icon className="text-emerald-600 text-[18px]">near_me</Icon>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">UAV Location</div>
                  <div className="data-font font-bold text-slate-900">{telemetry.latitude.toFixed(4)}, {telemetry.longitude.toFixed(4)}</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl bg-white/95 px-3.5 py-2 text-xs font-semibold text-slate-800 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/80">
                <Icon className="text-indigo-600 text-[18px]">radar</Icon>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Active Sector</div>
                  <div className="font-bold text-slate-900 truncate max-w-[220px]">{weather.sector} ({weather.locationName})</div>
                </div>
              </div>
            </div>

            {/* Top Right Controls Container (Map Style Selector + Panel Data Button) */}
            <div className="absolute top-6 right-6 z-[400] flex items-center gap-2">
              {/* Map Style Selector Pill */}
              <div className="flex items-center rounded-xl bg-white/95 p-1 shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-slate-200/80 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => onMapStyleChange?.('standard')}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                    mapStyle === 'standard'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Peta Jalan Standard (OpenStreetMap)"
                >
                  Standard
                </button>

                <button
                  type="button"
                  onClick={() => onMapStyleChange?.('satellite')}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                    mapStyle === 'satellite'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Peta Satelit Hybrid"
                >
                  Satelit
                </button>

                <button
                  type="button"
                  onClick={() => onMapStyleChange?.('terrain')}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                    mapStyle === 'terrain'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
                  className="flex items-center gap-1.5 rounded-xl bg-white/95 px-3.5 py-2 text-xs font-bold text-slate-800 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-slate-200/80 hover:bg-slate-900 hover:text-white transition cursor-pointer"
                  title="Buka Panel Informasi"
                >
                  <Icon className="text-[18px]">chevron_left</Icon>
                  <span>Panel Data</span>
                </button>
              )}
            </div>

            {/* Map Source Info Badge */}
            <div className="absolute bottom-6 left-6 z-[400] rounded-xl bg-white/95 px-4 py-2.5 text-xs text-slate-800 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-slate-200/80">
              <p className="font-bold text-slate-900">
                {mapStyle === 'satellite'
                  ? 'Esri World Imagery · Satelit Hybrid'
                  : mapStyle === 'terrain'
                  ? 'OpenTopoMap · Topografi'
                  : 'OpenStreetMap · Standard Street'}
              </p>
              <p className="text-[11px] text-slate-500">Live Mission Waypoints Overlay</p>
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
