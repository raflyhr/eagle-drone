import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import useWeather from '../hooks/useWeather'
import useDroneRegion from '../hooks/useDroneRegion'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function createDroneHeadingIcon(heading = 0, size = 32) {
  const rotation = typeof heading === 'number' ? heading : 0
  const innerSize = Math.round(size * 0.75)
  return L.divIcon({
    className: 'custom-drone-heading-marker',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
        <div style="position: relative; width: ${innerSize}px; height: ${innerSize}px; display: flex; align-items: center; justify-content: center; transform: rotate(${rotation}deg); transform-origin: center;">
          <svg viewBox="0 0 24 24" width="${innerSize}" height="${innerSize}">
            <path d="M12 2L3 21L12 16.5L21 21L12 2Z" fill="#0284c7" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function createStartPointIcon() {
  return L.divIcon({
    className: 'custom-start-marker',
    html: `
      <div style="width: 18px; height: 18px; border-radius: 50%; background: #22c55e; border: 3px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function createTargetPinIcon() {
  return L.divIcon({
    className: 'custom-target-marker',
    html: `
      <div style="width: 24px; height: 24px; border-radius: 4px; background: #dc2626; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; color: white;">
        <span class="material-symbols-outlined" style="font-size: 14px; font-weight: bold; line-height: 1;">location_on</span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

const defaultTelemetry = {
  latitude: -7.5950,
  longitude: 110.4485,
  altitude: 450,
  speed: 22,
  heading: 0,
  pitch: -2.5,
  roll: -1.0,
  yaw: 0,
  battery: 88,
  voltage: 16.1,
  current: 14.2,
  satellites: 18,
  gpsFix: '3D Fix',
  flightMode: 'AUTO',
  sysId: 1,
  compId: 1,
  packetCount: 0,
  signal: 98,
}

export default function MapArea({ onNavigate, telemetry: rawTelemetry, active, mapStyle = 'standard', onMapStyleChange }) {
  const telemetry = { ...defaultTelemetry, ...(rawTelemetry || {}) }
  const weather = useWeather(telemetry.latitude, telemetry.longitude)
  const droneRegionName = useDroneRegion(telemetry.latitude, telemetry.longitude)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isLocked, setIsLocked] = useState(true)
  const [isMarkingMode, setIsMarkingMode] = useState(false)
  const [customWaypoints, setCustomWaypoints] = useState([])
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const markerRef = useRef(null)
  const pathRef = useRef(null)
  const trailRef = useRef([])
  const baseLayerRef = useRef(null)
  const overlayLayerRef = useRef(null)
  const targetMarkersRef = useRef([])
  const startMarkerRef = useRef(null)
  const isMarkingModeRef = useRef(false)

  useEffect(() => {
    isMarkingModeRef.current = isMarkingMode
    if (leafletRef.current) {
      const container = leafletRef.current.getContainer()
      if (container) {
        container.style.cursor = isMarkingMode ? 'crosshair' : ''
      }
    }
  }, [isMarkingMode])

  const handleToggleMarkingMode = () => {
    setIsMarkingMode((prev) => {
      const next = !prev
      if (next) {
        // Immediately unlock map auto-centering when entering marking mode so user can freely pan
        setIsLocked(false)
      }
      return next
    })
  }

  const handleRecenter = () => {
    setIsLocked(true)
    if (leafletRef.current && telemetry.latitude && telemetry.longitude) {
      leafletRef.current.panTo([telemetry.latitude, telemetry.longitude], { animate: true })
    }
  }

  const handleFocusTarget = (wp) => {
    setIsLocked(false)
    if (leafletRef.current) {
      leafletRef.current.flyTo([wp.lat, wp.lon], 16, { animate: true, duration: 0.8 })
    }
  }

  const handleRemoveCustomWp = (id) => {
    setCustomWaypoints((prev) => prev.filter((w) => w.id !== id))
  }

  const handleClearCustomWps = () => {
    setCustomWaypoints([])
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

    // Click on map to drop target point ONLY when isMarkingMode is active
    map.on('click', (e) => {
      if (!isMarkingModeRef.current) return

      const clickedLat = Number(e.latlng.lat.toFixed(6))
      const clickedLon = Number(e.latlng.lng.toFixed(6))
      setCustomWaypoints((prev) => [
        ...prev,
        {
          id: `target-${Date.now()}`,
          name: `Target #${prev.length + 1}`,
          lat: clickedLat,
          lon: clickedLon,
          isVictim: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setIsMarkingMode(false)
    })

    trailRef.current = [initialPos]
    pathRef.current = L.polyline(trailRef.current, {
      color: '#0284c7',
      weight: 3.5,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map)

    startMarkerRef.current = L.marker(initialPos, { icon: createStartPointIcon() }).addTo(map).bindPopup('Takeoff Point')

    const customIcon = createDroneHeadingIcon(telemetry.heading || 0, 32)

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
      startMarkerRef.current = null
      pathRef.current = null
      baseLayerRef.current = null
      overlayLayerRef.current = null
    }
  }, [])

  // Sync Custom Target Markers on Map
  useEffect(() => {
    if (!leafletRef.current) return
    const map = leafletRef.current

    targetMarkersRef.current.forEach((m) => m.remove())
    targetMarkersRef.current = []

    customWaypoints.forEach((wp) => {
      const icon = createTargetPinIcon()
      const marker = L.marker([wp.lat, wp.lon], { icon })
        .addTo(map)
        .bindPopup(`<b>${wp.name}</b><br/>Coordinates: ${wp.lat}, ${wp.lon}<br/>Timestamp: ${wp.time}`)
      targetMarkersRef.current.push(marker)
    })
  }, [customWaypoints])

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
          attribution: '&copy; Esri Satellite',
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
        attribution: '&copy; OpenTopoMap',
        maxZoom: 17,
      }).addTo(map)
    } else {
      // Default: 'standard' (OpenStreetMap)
      baseLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
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
    markerRef.current.setIcon(createDroneHeadingIcon(telemetry.heading || 0, 32))
    
    // Only auto-pan map when locked onto drone
    if (isLocked) {
      leafletRef.current.panTo(position, { animate: true })
    }

    const lastPos = trailRef.current[trailRef.current.length - 1]
    if (!lastPos) {
      trailRef.current = [position]
    } else {
      const dLat = lastPos[0] - position[0]
      const dLon = lastPos[1] - position[1]
      const jumpDist = Math.sqrt(dLat * dLat + dLon * dLon)

      if (jumpDist > 0.005) {
        // Teleportation / Initial jump reset
        trailRef.current = [position]
      } else if (jumpDist > 0.00001) {
        trailRef.current.push(position)
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
    <main className="ml-[72px] flex-1 flex flex-col min-h-screen bg-slate-100 text-slate-900">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-2">
          <Icon className="text-[20px] text-slate-700">map</Icon>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase">Map & Search Area</h2>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row min-h-0 relative">
        {/* Map Viewport Area */}
        <div className="relative flex-1 min-h-[450px] overflow-hidden bg-slate-200">
          <div ref={mapRef} className="absolute inset-0" />
          
          {/* Top Left Floating UAV & Location Badges */}
          <div className="absolute left-4 top-4 z-[400] flex flex-wrap gap-2 pointer-events-auto">
            <div className="flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white border border-slate-800">
              <Icon className="text-sky-400 text-[16px]">near_me</Icon>
              <span className="text-slate-400 font-medium">UAV:</span>
              <span className="data-font font-bold text-white">
                {(telemetry.latitude ?? -7.5950).toFixed(5)}, {(telemetry.longitude ?? 110.4485).toFixed(5)}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 border border-slate-200">
              <Icon className="text-slate-700 text-[16px]">location_on</Icon>
              <span className="text-slate-500 font-medium">Region:</span>
              <span className="font-bold text-slate-900 truncate max-w-[320px] sm:max-w-none">
                {droneRegionName}
              </span>
            </div>
          </div>

          {/* Top Right Controls Container */}
          <div className="absolute top-4 right-4 z-[400] flex items-center gap-2 pointer-events-auto">
            {/* Recenter Drone Position Button */}
            <button
              type="button"
              onClick={handleRecenter}
              className={`flex items-center justify-center w-8 h-8 rounded-md border transition cursor-pointer ${
                isLocked
                  ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 active:scale-95'
              }`}
              title={isLocked ? 'Map Locked to Drone' : 'Recenter Map to Drone'}
            >
              <Icon className="text-[18px]">{isLocked ? 'my_location' : 'location_searching'}</Icon>
            </button>

            {/* Map Style Selector */}
            <div className="flex items-center rounded-md bg-white p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => onMapStyleChange?.('standard')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  mapStyle === 'standard'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="Standard Street Map (OSM)"
              >
                Standard
              </button>

              <button
                type="button"
                onClick={() => onMapStyleChange?.('satellite')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  mapStyle === 'satellite'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="Hybrid Satellite Map"
              >
                Satellite
              </button>

              <button
                type="button"
                onClick={() => onMapStyleChange?.('terrain')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  mapStyle === 'terrain'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="Topographic Altitude Map"
              >
                Terrain
              </button>
            </div>

            {/* Expand Sidebar Trigger Button */}
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 border border-slate-200 hover:bg-slate-900 hover:text-white transition cursor-pointer"
                title="Open Data Panel"
              >
                <Icon className="text-[16px]">chevron_left</Icon>
                <span>Panel</span>
              </button>
            )}
          </div>

          {/* Zoom In / Zoom Out Controls */}
          <div className="absolute bottom-4 right-4 z-[400] flex flex-col rounded-md bg-white border border-slate-200 overflow-hidden pointer-events-auto">
            <button
              type="button"
              onClick={() => leafletRef.current?.zoomIn()}
              className="flex items-center justify-center w-8 h-8 text-slate-700 hover:bg-slate-900 hover:text-white border-b border-slate-200 transition cursor-pointer active:scale-95"
              title="Zoom In (+)"
            >
              <Icon className="text-[18px]">add</Icon>
            </button>
            <button
              type="button"
              onClick={() => leafletRef.current?.zoomOut()}
              className="flex items-center justify-center w-8 h-8 text-slate-700 hover:bg-slate-900 hover:text-white transition cursor-pointer active:scale-95"
              title="Zoom Out (-)"
            >
              <Icon className="text-[18px]">remove</Icon>
            </button>
          </div>

          {/* Map Source Info Badge */}
          <div className="absolute bottom-4 left-4 z-[400] rounded-md bg-white px-2.5 py-1 text-xs text-slate-700 border border-slate-200 font-medium pointer-events-auto">
            <span className="text-slate-500">Map: </span>
            <span className="font-bold text-slate-900">
              {mapStyle === 'satellite'
                ? 'Esri Satellite'
                : mapStyle === 'terrain'
                ? 'OpenTopoMap'
                : 'OpenStreetMap'}
            </span>
          </div>
        </div>

        {/* Right Sidebar: Pure Solid Panel (Zero Glassmorphism) */}
        <aside
          className={`relative z-[500] border-t lg:border-t-0 lg:border-l border-slate-200 bg-white transition-all duration-300 ease-in-out overflow-y-auto ${
            isSidebarCollapsed
              ? 'w-0 border-0 p-0 hidden lg:hidden'
              : 'w-full lg:w-[380px] p-4 flex flex-col gap-4 bg-white'
          }`}
        >
          {/* Sidebar Minimize Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Icon className="text-[18px] text-slate-700">space_dashboard</Icon>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Mission Tracking</span>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(true)}
              className="flex items-center gap-1 rounded-md bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 px-2.5 py-1 text-xs font-semibold transition border border-slate-200 cursor-pointer"
              title="Hide Sidebar Panel"
            >
              <span>Hide</span>
              <Icon className="text-[14px]">chevron_right</Icon>
            </button>
          </div>

          {/* Current Drone Location Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5">
            <div className="mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Drone Region</span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 leading-snug mb-1">
              {droneRegionName}
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Live Flight Telemetry • Active Navigation
            </p>

            {/* Real-time Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 rounded-md p-2 border border-slate-200/80">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Coordinates</p>
                <p className="font-bold text-slate-900 data-font truncate" title={`${telemetry.latitude}, ${telemetry.longitude}`}>
                  {(telemetry.latitude ?? -7.5950).toFixed(5)}, {(telemetry.longitude ?? 110.4485).toFixed(5)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-md p-2 border border-slate-200/80">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Altitude (Alt)</p>
                <p className="font-bold text-slate-900 data-font">
                  {telemetry.altitude ?? 0} m MSL
                </p>
              </div>
              <div className="bg-slate-50 rounded-md p-2 border border-slate-200/80">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Ground Speed</p>
                <p className="font-bold text-slate-900 data-font">
                  {telemetry.speed ?? 0} m/s ({(((telemetry.speed ?? 0) * 3.6)).toFixed(1)} km/h)
                </p>
              </div>
              <div className="bg-slate-50 rounded-md p-2 border border-slate-200/80">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Heading</p>
                <p className="font-bold text-slate-900 data-font">
                  {telemetry.heading ?? 0}°
                </p>
              </div>
            </div>
          </div>

          {/* Target Points Section */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Icon className="text-slate-700 text-[18px]">location_on</Icon>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Target Points</h3>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                  {customWaypoints.length}
                </span>
              </div>
              {customWaypoints.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCustomWps}
                  className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline transition cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Mode Penanda Action Button */}
            <div className="mb-3">
              <button
                type="button"
                onClick={handleToggleMarkingMode}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition cursor-pointer border ${
                  isMarkingMode
                    ? 'bg-red-600 text-white border-red-700'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                }`}
              >
                <Icon className="text-[16px]">{isMarkingMode ? 'close' : 'add_location_alt'}</Icon>
                <span>{isMarkingMode ? 'Cancel Target Pin Mode' : 'Add Target Marker'}</span>
              </button>
              {isMarkingMode && (
                <div className="mt-2 p-2 rounded-md bg-red-50 border border-red-200 text-center">
                  <p className="text-[11px] text-red-700 font-semibold leading-tight">
                    Click anywhere on the map to place a target pin.
                  </p>
                </div>
              )}
            </div>

            {/* Target List or Clean Empty State */}
            {customWaypoints.length > 0 ? (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {customWaypoints.map((wp) => (
                  <div
                    key={wp.id}
                    className="flex items-center gap-2.5 rounded-md p-2 border border-slate-200 bg-slate-50 transition"
                  >
                    <Icon className="text-red-600 text-[20px] shrink-0">location_on</Icon>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {wp.name}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500 data-font">
                        {wp.lat.toFixed(4)}, {wp.lon.toFixed(4)} • {wp.time}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleFocusTarget(wp)}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200 transition cursor-pointer"
                        title="Focus Map on This Target"
                      >
                        <Icon className="text-[15px]">center_focus_strong</Icon>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomWp(wp.id)}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 transition cursor-pointer"
                        title="Delete Target Point"
                      >
                        <Icon className="text-[15px]">delete</Icon>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-xs font-semibold text-slate-700">No Target Points</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Click &quot;Add Target Marker&quot; then click on map to drop a pin.</p>
              </div>
            )}
          </div>

          {/* Environment Metrics */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Icon className="text-slate-700 text-[18px]">analytics</Icon>
                Local Environment Metrics
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Wind Speed', `${weather.windSpeed} m/s`],
                ['Humidity', `${weather.humidity}%`],
                ['Temp', `${weather.temperature} °C`],
                ['Signal Link', `${telemetry.signal || 98}%`],
              ].map(([label, value]) => (
                <div key={label} className="bg-slate-50 rounded-md p-2 border border-slate-200/80">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="data-font text-xs font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
