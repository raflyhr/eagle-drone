import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import useCamera from '../hooks/useCamera'
import useObjectDetection from '../hooks/useObjectDetection'
import useWeather, { degreesToCardinal } from '../hooks/useWeather'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

function createDroneHeadingIcon(heading = 0, size = 28) {
  const rotation = typeof heading === 'number' ? heading : 0
  const innerSize = Math.round(size * 0.7)
  return L.divIcon({
    className: 'custom-drone-heading-marker',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: ${size}px; height: ${size}px; border-radius: 50%; background: rgba(16, 185, 129, 0.2); animation: ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position: relative; width: ${innerSize}px; height: ${innerSize}px; display: flex; align-items: center; justify-content: center; transform: rotate(${rotation}deg); transition: transform 0.3s ease-out; transform-origin: center;">
          <svg viewBox="0 0 24 24" width="${innerSize}" height="${innerSize}" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">
            <path d="M12 2L3 21L12 16.5L21 21L12 2Z" fill="#10b981" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function MissionOverview({ onNavigate, telemetryState, mapStyle = 'standard', onMapStyleChange }) {
  const telemetry = telemetryState?.telemetry || {
    latitude: -6.2,
    longitude: 106.816666,
    altitude: 120,
    speed: 15,
    heading: 285,
    pitch: 2.4,
    roll: -1.2,
    yaw: 285,
    battery: 74,
    voltage: 15.2,
    current: 12.5,
    satellites: 14,
    gpsFix: '3D Fix',
    flightMode: 'AUTO',
    sysId: 1,
    compId: 1,
    packetCount: 142,
    lastHeartbeat: Date.now(),
  }

  const {
    connectionStatus = 'connected',
    connectionType = 'simulation',
    connectSerial,
    connectWebSocket,
    enableMavlinkSim,
    disconnect: disconnectMavlink,
  } = telemetryState || {}

  const weather = useWeather(telemetry.latitude, telemetry.longitude)
  
  // Real Camera Device Hook (No Dummy Data)
  const {
    videoRef,
    devices,
    selectedDeviceId,
    cameraStatus,
    permissionState,
    activeCameraSpecs,
    errorMessage: cameraError,
    selectCamera,
    toggleCamera,
    scanDevices,
  } = useCamera()

  const [aiActive, setAiActive] = useState(true)
  const [showMavlinkModal, setShowMavlinkModal] = useState(false)
  const [wsUrlInput, setWsUrlInput] = useState('ws://localhost:8080')
  const [isCameraDropdownOpen, setIsCameraDropdownOpen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFullscreenMap, setShowFullscreenMap] = useState(true)
  const [miniMapPos, setMiniMapPos] = useState({ x: null, y: null })
  const [isDraggingMap, setIsDraggingMap] = useState(false)
  const dragStartPos = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 })
  const hideTimerRef = useRef(null)

  const handleVideoMouseMove = () => {
    setShowControls(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false)
    }, 2500)
  }

  const handleVideoMouseLeave = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false)
    }, 800)
  }

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Drag-and-drop handler for Fullscreen Mini Map
  const handleMiniMapDragStart = (e) => {
    if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return

    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : null)
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : null)
    if (clientX === null || clientY === null) return

    const container = videoPanelRef.current?.getBoundingClientRect()
    const mapElement = e.currentTarget.getBoundingClientRect()

    const currentLeft = miniMapPos.x !== null ? miniMapPos.x : (mapElement.left - (container?.left || 0))
    const currentTop = miniMapPos.y !== null ? miniMapPos.y : (mapElement.top - (container?.top || 0))

    dragStartPos.current = {
      startX: clientX,
      startY: clientY,
      initialLeft: currentLeft,
      initialTop: currentTop,
    }
    setIsDraggingMap(true)
  }

  useEffect(() => {
    if (!isDraggingMap) return

    const handlePointerMove = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : null)
      const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : null)
      if (clientX === null || clientY === null) return

      const deltaX = clientX - dragStartPos.current.startX
      const deltaY = clientY - dragStartPos.current.startY

      const container = videoPanelRef.current?.getBoundingClientRect()
      const containerWidth = container?.width || window.innerWidth
      const containerHeight = container?.height || window.innerHeight

      const mapWidth = 288
      const mapHeight = 208

      let newLeft = dragStartPos.current.initialLeft + deltaX
      let newTop = dragStartPos.current.initialTop + deltaY

      newLeft = Math.max(12, Math.min(newLeft, containerWidth - mapWidth - 12))
      newTop = Math.max(12, Math.min(newTop, containerHeight - mapHeight - 12))

      setMiniMapPos({ x: newLeft, y: newTop })
    }

    const handlePointerUp = () => {
      setIsDraggingMap(false)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    window.addEventListener('touchmove', handlePointerMove)
    window.addEventListener('touchend', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      window.removeEventListener('touchmove', handlePointerMove)
      window.removeEventListener('touchend', handlePointerUp)
    }
  }, [isDraggingMap])

  const { detections } = useObjectDetection(videoRef, aiActive && cameraStatus === 'connected')
  const videoPanelRef = useRef(null)
  const videoFrameRef = useRef(null)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const markerRef = useRef(null)
  const pathRef = useRef(null)
  const baseLayerRef = useRef(null)
  const overlayLayerRef = useRef(null)

  const fullscreenMapRef = useRef(null)
  const fullscreenLeafletRef = useRef(null)
  const fullscreenMarkerRef = useRef(null)
  const fullscreenPathRef = useRef(null)
  const fullscreenBaseLayerRef = useRef(null)
  const fullscreenOverlayLayerRef = useRef(null)

  const [overlayVersion, setOverlayVersion] = useState(0)

  // Observer for video canvas scaling
  useEffect(() => {
    if (!videoFrameRef.current) return
    const observer = new ResizeObserver(() => setOverlayVersion((v) => v + 1))
    observer.observe(videoFrameRef.current)
    return () => observer.disconnect()
  }, [cameraStatus])

  // Canvas drawing for AI detections
  useEffect(() => {
    const canvas = videoFrameRef.current?.querySelector('canvas')
    const video = videoRef.current
    if (!canvas || !video) return
    const context = canvas.getContext('2d')
    if (!aiActive || cameraStatus !== 'connected') {
      context.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    const rect = video.getBoundingClientRect()
    const sourceWidth = video.videoWidth
    const sourceHeight = video.videoHeight
    if (!sourceWidth || !sourceHeight) return
    const ratio = Math.max(rect.width / sourceWidth, rect.height / sourceHeight)
    const offsetX = (rect.width - sourceWidth * ratio) / 2
    const offsetY = (rect.height - sourceHeight * ratio) / 2
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, rect.width, rect.height)
    context.lineWidth = 2
    context.font = '700 11px JetBrains Mono, monospace'

    detections.forEach(({ bbox, score }) => {
      const [x, y, width, height] = bbox
      const boxX = x * ratio + offsetX
      const boxY = y * ratio + offsetY
      const boxWidth = width * ratio
      const boxHeight = height * ratio
      context.fillStyle = 'rgba(16, 185, 129, 0.15)'
      context.fillRect(boxX, boxY, boxWidth, boxHeight)
      context.strokeStyle = '#10b981'
      context.strokeRect(boxX, boxY, boxWidth, boxHeight)
      const label = `PERSON ${Math.round(score * 100)}%`
      const labelWidth = context.measureText(label).width + 12
      context.fillStyle = '#10b981'
      context.fillRect(boxX, Math.max(0, boxY - 20), labelWidth, 20)
      context.fillStyle = '#ffffff'
      context.fillText(label, boxX + 6, Math.max(14, boxY - 6))
    })
  }, [cameraStatus, aiActive, detections, overlayVersion, videoRef])

  const trailRef = useRef([])

  // Initialize mini Leaflet Map
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return

    const initialPos = [telemetry.latitude || -7.5950, telemetry.longitude || 110.4485]
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    }).setView(initialPos, 14)

    trailRef.current = [initialPos]
    pathRef.current = L.polyline(trailRef.current, {
      color: '#38bdf8',
      weight: 3,
      dashArray: '5, 5',
      opacity: 0.95,
    }).addTo(map)

    const customIcon = createDroneHeadingIcon(telemetry.heading || 0, 28)

    markerRef.current = L.marker(initialPos, { icon: customIcon }).addTo(map)
    leafletRef.current = map

    return () => {
      map.remove()
      leafletRef.current = null
      markerRef.current = null
      pathRef.current = null
      baseLayerRef.current = null
      overlayLayerRef.current = null
    }
  }, [])

  // Dynamic Tile Layer for Mini-Map
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
        { maxZoom: 19 }
      ).addTo(map)

      overlayLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(map)
    } else if (mapStyle === 'terrain') {
      baseLayerRef.current = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
      }).addTo(map)
    } else {
      baseLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)
    }
  }, [mapStyle])

  // Update map marker position & heading
  useEffect(() => {
    if (!leafletRef.current || !markerRef.current || !telemetry.latitude || !telemetry.longitude) return
    const newPos = [telemetry.latitude, telemetry.longitude]
    markerRef.current.setLatLng(newPos)
    markerRef.current.setIcon(createDroneHeadingIcon(telemetry.heading || 0, 28))
    leafletRef.current.panTo(newPos, { animate: true, duration: 0.8 })

    const lastPos = trailRef.current[trailRef.current.length - 1]
    if (!lastPos || Math.abs(lastPos[0] - newPos[0]) > 0.00001 || Math.abs(lastPos[1] - newPos[1]) > 0.00001) {
      trailRef.current.push(newPos)
      if (trailRef.current.length > 2000) {
        trailRef.current.splice(1, 1) // preserve index 0 (initial takeoff point)
      }
    }
    if (pathRef.current) {
      pathRef.current.setLatLngs(trailRef.current)
    }
  }, [telemetry.latitude, telemetry.longitude, telemetry.heading])

  // Initialize & Update Fullscreen Top-Right Mini Map
  useEffect(() => {
    if (!isFullscreen || !showFullscreenMap || !fullscreenMapRef.current) {
      if (fullscreenLeafletRef.current) {
        fullscreenLeafletRef.current.remove()
        fullscreenLeafletRef.current = null
        fullscreenMarkerRef.current = null
        fullscreenPathRef.current = null
        fullscreenBaseLayerRef.current = null
        fullscreenOverlayLayerRef.current = null
      }
      return
    }

    if (fullscreenLeafletRef.current) {
      setTimeout(() => fullscreenLeafletRef.current?.invalidateSize(), 100)
      return
    }

    const initialPos = [telemetry.latitude || -7.5950, telemetry.longitude || 110.4485]
    const map = L.map(fullscreenMapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
    }).setView(initialPos, 14)

    if (mapStyle === 'satellite') {
      fullscreenBaseLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map)
      fullscreenOverlayLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(map)
    } else if (mapStyle === 'terrain') {
      fullscreenBaseLayerRef.current = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
      }).addTo(map)
    } else {
      fullscreenBaseLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)
    }

    const customIcon = createDroneHeadingIcon(telemetry.heading || 0, 28)

    fullscreenMarkerRef.current = L.marker(initialPos, { icon: customIcon }).addTo(map)
    fullscreenPathRef.current = L.polyline(trailRef.current, {
      color: '#38bdf8',
      weight: 3,
      dashArray: '5, 5',
      opacity: 0.95,
    }).addTo(map)

    fullscreenLeafletRef.current = map
    setTimeout(() => map.invalidateSize(), 150)

    return () => {
      map.remove()
      fullscreenLeafletRef.current = null
      fullscreenMarkerRef.current = null
      fullscreenPathRef.current = null
      fullscreenBaseLayerRef.current = null
      fullscreenOverlayLayerRef.current = null
    }
  }, [isFullscreen, showFullscreenMap])

  // Tile layer update for Fullscreen Map
  useEffect(() => {
    if (!fullscreenLeafletRef.current) return
    const map = fullscreenLeafletRef.current
    if (fullscreenBaseLayerRef.current) {
      map.removeLayer(fullscreenBaseLayerRef.current)
      fullscreenBaseLayerRef.current = null
    }
    if (fullscreenOverlayLayerRef.current) {
      map.removeLayer(fullscreenOverlayLayerRef.current)
      fullscreenOverlayLayerRef.current = null
    }
    if (mapStyle === 'satellite') {
      fullscreenBaseLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map)
      fullscreenOverlayLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(map)
    } else if (mapStyle === 'terrain') {
      fullscreenBaseLayerRef.current = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
      }).addTo(map)
    } else {
      fullscreenBaseLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)
    }
  }, [mapStyle, isFullscreen, showFullscreenMap])

  // Update fullscreen map position & heading
  useEffect(() => {
    if (!fullscreenLeafletRef.current || !fullscreenMarkerRef.current || !telemetry.latitude || !telemetry.longitude) return
    const newPos = [telemetry.latitude, telemetry.longitude]
    fullscreenMarkerRef.current.setLatLng(newPos)
    fullscreenMarkerRef.current.setIcon(createDroneHeadingIcon(telemetry.heading || 0, 28))
    fullscreenLeafletRef.current.panTo(newPos, { animate: true, duration: 0.8 })
    if (fullscreenPathRef.current && trailRef.current.length > 0) {
      fullscreenPathRef.current.setLatLngs(trailRef.current)
    }
  }, [telemetry.latitude, telemetry.longitude, telemetry.heading, isFullscreen, showFullscreenMap])

  return (
    <main className="ml-[72px] flex-1 flex flex-col h-screen overflow-hidden bg-[#f5f7fa] text-[#0f172a]">
      {/* Top Header Bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#eef2f6] bg-white px-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Eagle Drone</h2>
        </div>

        {/* MAVLink Connection Status Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowMavlinkModal(true)}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs text-slate-700 shadow-xs transition cursor-pointer"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="font-medium">
              MAVLink: <strong className="font-bold text-slate-900">{connectionStatus === 'connected' ? connectionType.toUpperCase() : 'Disconnected'}</strong>
            </span>
            <Icon className="text-[16px] text-slate-400 ml-0.5">settings_remote</Icon>
          </button>
        </div>
      </header>

      {/* Main Bento Grid Canvas */}
      <div className="flex-1 min-h-0 overflow-hidden p-3.5 md:p-4 lg:p-5">
        <div className="dashboard-grid-container mx-auto max-w-[1700px] gap-3 lg:gap-3.5">
          {/* TOP ROW: Dominant & Tall (Camera Col 9 + Weather Col 3) */}
          <div className="grid grid-cols-12 gap-3 lg:gap-3.5 h-full min-h-0">
            {/* TOP-LEFT: Main Drone Camera Viewfinder Feed */}
            <div className="col-span-12 lg:col-span-9 h-full min-h-0 flex flex-col">
              <div
                ref={videoPanelRef}
                onMouseMove={handleVideoMouseMove}
                onMouseLeave={handleVideoMouseLeave}
                className={`group relative flex flex-1 h-full min-h-0 flex-col overflow-hidden rounded-2xl ${
                  cameraStatus === 'connected' ? 'bg-slate-950' : 'bg-slate-100/90'
                } shadow-sm border border-slate-200/80 [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none`}
              >
                {/* Video Frame Container */}
                <div ref={videoFrameRef} className="relative flex-1 h-full min-h-0 w-full bg-slate-950 overflow-hidden">
                  {/* Live WebCam Stream */}
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-full w-full object-cover ${cameraStatus === 'connected' ? 'block' : 'hidden'}`}
                  />
                  {cameraStatus === 'connected' && (
                    <canvas className="pointer-events-none absolute inset-0 z-20" />
                  )}

                  {/* Fullscreen Movable Pure Mini Map Overlay */}
                  {isFullscreen && showFullscreenMap && (
                    <div
                      onMouseDown={handleMiniMapDragStart}
                      onTouchStart={handleMiniMapDragStart}
                      style={
                        miniMapPos.x !== null && miniMapPos.y !== null
                          ? { left: `${miniMapPos.x}px`, top: `${miniMapPos.y}px` }
                          : { top: '16px', right: '16px' }
                      }
                      className={`absolute z-40 w-64 h-48 sm:w-72 sm:h-52 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden pointer-events-auto flex flex-col transition-shadow ${
                        isDraggingMap ? 'cursor-grabbing shadow-inner ring-2 ring-emerald-500/50' : 'cursor-grab hover:border-slate-500'
                      }`}
                    >
                      <div ref={fullscreenMapRef} className="absolute inset-0 z-0 h-full w-full" />

                      {/* Top Controls: Map Style Selector + Hide Button (Auto-hides on idle) */}
                      <div
                        className={`absolute top-2 inset-x-2 z-20 flex items-center justify-between pointer-events-none transition-opacity duration-300 ${
                          showControls ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg bg-white p-1 shadow-md border border-slate-200">
                          <button
                            type="button"
                            onClick={() => onMapStyleChange?.('standard')}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                              mapStyle === 'standard'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                            title="Peta Standard (OSM)"
                          >
                            Standard
                          </button>
                          <button
                            type="button"
                            onClick={() => onMapStyleChange?.('satellite')}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                              mapStyle === 'satellite'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                            title="Peta Satelit"
                          >
                            Satelit
                          </button>
                          <button
                            type="button"
                            onClick={() => onMapStyleChange?.('terrain')}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                              mapStyle === 'terrain'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                            title="Peta Topografi"
                          >
                            Topografi
                          </button>
                        </div>

                        {/* Hide Mini Map Button */}
                        <button
                          type="button"
                          onClick={() => setShowFullscreenMap(false)}
                          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900/90 text-white shadow-md hover:bg-slate-800 transition border border-slate-700 cursor-pointer"
                          title="Sembunyikan Mini Map"
                        >
                          <Icon className="text-[14px]">close</Icon>
                        </button>
                      </div>

                      {/* Fullscreen Mini-Map Zoom In / Zoom Out Controls (Auto-hides on idle) */}
                      <div
                        className={`absolute right-2 top-11 z-20 flex flex-col rounded-lg bg-white shadow-md border border-slate-200 overflow-hidden transition-opacity duration-300 ${
                          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => fullscreenLeafletRef.current?.zoomIn()}
                          className="flex items-center justify-center w-6 h-6 text-slate-700 hover:bg-slate-900 hover:text-white border-b border-slate-200 transition cursor-pointer active:scale-95"
                          title="Zoom In (+)"
                        >
                          <Icon className="text-[15px]">add</Icon>
                        </button>
                        <button
                          type="button"
                          onClick={() => fullscreenLeafletRef.current?.zoomOut()}
                          className="flex items-center justify-center w-6 h-6 text-slate-700 hover:bg-slate-900 hover:text-white transition cursor-pointer active:scale-95"
                          title="Zoom Out (-)"
                        >
                          <Icon className="text-[15px]">remove</Icon>
                        </button>
                      </div>

                      {/* Bottom Overlay Info (Auto-hides on idle) */}
                      <div
                        className={`absolute bottom-2 inset-x-2 z-20 rounded-lg bg-white p-2 shadow-md border border-slate-200 flex items-center justify-between pointer-events-auto transition-opacity duration-300 ${
                          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Drone Location</span>
                          <p className="text-[11px] font-bold text-slate-900 truncate" title={weather.locationName}>
                            {weather.locationName}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 data-font">{telemetry.satellites} Sats</span>
                      </div>
                    </div>
                  )}

                  {/* Floating Video Control Bar (Auto-hides on idle) */}
                  {cameraStatus === 'connected' && (
                    <div
                      className={`absolute bottom-3 inset-x-3 z-30 flex items-center justify-between transition-all duration-300 ${
                        showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                      }`}
                    >
                      {/* Left Controls: Stop Camera, AI Detect, Camera Selector */}
                      <div className="flex items-center gap-2 pointer-events-auto bg-slate-900 border border-slate-800 rounded-lg p-1.5 shadow-lg">
                        {/* Stop Camera Button */}
                        <button
                          type="button"
                          onClick={toggleCamera}
                          className="flex items-center gap-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold transition shrink-0 cursor-pointer shadow-xs"
                          title="Putus Stream Kamera"
                        >
                          <Icon className="text-[14px]">videocam_off</Icon>
                          <span>Putus Kamera</span>
                        </button>

                        {/* AI Detection Toggle Button */}
                        <button
                          type="button"
                          onClick={() => setAiActive((v) => !v)}
                          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition shrink-0 cursor-pointer ${
                            aiActive
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <Icon className="text-[14px]">center_focus_strong</Icon>
                          <span>AI Detect {aiActive ? `(${detections.length})` : 'Off'}</span>
                        </button>

                        {/* Camera Switcher Selector */}
                        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-xs font-medium text-slate-200">
                          <select
                            value={selectedDeviceId}
                            onChange={(e) => selectCamera(e.target.value)}
                            className="bg-slate-800 text-xs font-semibold text-white focus:outline-none cursor-pointer max-w-[160px] sm:max-w-[220px] truncate"
                          >
                            {devices.length > 0 ? (
                              devices.map((dev, idx) => (
                                <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-slate-900 text-white">
                                  {dev.label}
                                </option>
                              ))
                            ) : (
                              <option value="" className="bg-slate-900 text-white">
                                {activeCameraSpecs?.label || 'Kamera Fisik Terdeteksi'}
                              </option>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => scanDevices(true)}
                            className="text-slate-400 hover:text-white transition cursor-pointer"
                            title="Scan ulang kamera"
                          >
                            <Icon className="text-[13px]">refresh</Icon>
                          </button>
                        </div>
                      </div>

                      {/* Right Controls: Resolution Specs, Fullscreen Map Toggle & Fullscreen */}
                      <div className="flex items-center gap-2 pointer-events-auto bg-slate-900 border border-slate-800 rounded-lg p-1.5 shadow-lg">
                        {activeCameraSpecs && (
                          <div className="text-[11px] text-slate-300 font-medium font-mono hidden sm:block px-1.5">
                            {activeCameraSpecs.width}x{activeCameraSpecs.height} @ {Math.round(activeCameraSpecs.frameRate)}fps
                          </div>
                        )}

                        {/* Toggle Fullscreen Mini-Map Button */}
                        {isFullscreen && (
                          <button
                            type="button"
                            onClick={() => setShowFullscreenMap((v) => !v)}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition shrink-0 cursor-pointer ${
                              showFullscreenMap
                                ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
                                : 'bg-emerald-600 text-white shadow-xs'
                            }`}
                            title={showFullscreenMap ? 'Sembunyikan Mini Map' : 'Tampilkan Mini Map'}
                          >
                            <Icon className="text-[14px]">map</Icon>
                            <span>{showFullscreenMap ? 'Sembunyikan Map' : 'Tampilkan Map'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (!videoPanelRef.current) return
                            if (!document.fullscreenElement) {
                              videoPanelRef.current.requestFullscreen().catch((err) => console.warn(err))
                            } else {
                              document.exitFullscreen().catch((err) => console.warn(err))
                            }
                          }}
                          className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white transition cursor-pointer"
                          title="Toggle Fullscreen"
                        >
                          <Icon className="text-[15px]">fullscreen</Icon>
                          <span className="hidden sm:inline">Fullscreen</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Camera Offline / Selection Standby View */}
                  {cameraStatus !== 'connected' && (
                    <div className="relative flex h-full w-full flex-col items-center justify-center bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-6 overflow-hidden">
                      {/* Corner Framing Brackets */}
                      <div className="pointer-events-none absolute inset-4 sm:inset-6 flex flex-col justify-between">
                        <div className="flex justify-between">
                          <div className="h-5 w-5 border-t-2 border-l-2 border-slate-300" />
                          <div className="h-5 w-5 border-t-2 border-r-2 border-slate-300" />
                        </div>
                        <div className="flex justify-between">
                          <div className="h-5 w-5 border-b-2 border-l-2 border-slate-300" />
                          <div className="h-5 w-5 border-b-2 border-r-2 border-slate-300" />
                        </div>
                      </div>

                      {/* Top Header */}
                      <div className="absolute top-4 inset-x-6 flex items-center justify-between text-[11px] font-semibold text-slate-500 data-font pointer-events-none">
                        <span className="text-slate-700 tracking-wider font-bold">DRONE CAMERA FEED</span>
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          REAL HARDWARE INPUT ONLY
                        </span>
                      </div>

                      {/* Hardware Device Selection Box */}
                      <div className="relative z-10 flex flex-col items-center max-w-xs sm:max-w-[340px] w-full text-center bg-white/95 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-md">
                        {/* Camera Icon without background box */}
                        <Icon className="text-[40px] text-slate-800 mb-2">videocam</Icon>

                        <h3 className="text-sm font-extrabold text-slate-900">Perangkat Kamera Terdeteksi</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-4">
                          {permissionState === 'denied'
                            ? 'Akses kamera ditolak. Harap beri izin di browser.'
                            : devices.length > 0
                            ? `Terdeteksi ${devices.length} perangkat kamera fisik pada komputer Anda.`
                            : 'Klik tombol di bawah untuk memindai & mengizinkan perangkat kamera.'}
                        </p>

                        {/* Custom White Camera Dropdown Selector (No dark background box, no checklist button) */}
                        {devices.length > 0 && (
                          <div className="w-full mb-4 text-left relative">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Pilih Kamera Fisik:
                            </label>
                            
                            {/* Trigger Button - White background matching screenshot style */}
                            <div
                              onClick={() => setIsCameraDropdownOpen((v) => !v)}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-800 shadow-sm cursor-pointer hover:border-slate-400 transition"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <Icon className="text-[18px] text-slate-600 shrink-0">videocam</Icon>
                                <span className="truncate">
                                  {devices.find((d) => d.deviceId === selectedDeviceId)?.label || 'Pilih Perangkat Kamera'}
                                </span>
                              </div>
                              <Icon className={`text-[18px] text-slate-400 shrink-0 transition-transform ${isCameraDropdownOpen ? 'rotate-180' : ''}`}>
                                expand_more
                              </Icon>
                            </div>

                            {/* Dropdown Options Popover */}
                            {isCameraDropdownOpen && (
                              <div className="absolute top-full inset-x-0 mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-lg py-1 max-h-48 overflow-y-auto">
                                {devices.map((dev, idx) => (
                                  <div
                                    key={dev.deviceId || idx}
                                    onClick={() => {
                                      selectCamera(dev.deviceId)
                                      setIsCameraDropdownOpen(false)
                                    }}
                                    className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold cursor-pointer transition ${
                                      dev.deviceId === selectedDeviceId
                                        ? 'bg-slate-100 text-slate-900 font-bold'
                                        : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <Icon className="text-[16px] text-slate-500 shrink-0">videocam</Icon>
                                    <span className="truncate">{dev.label}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Control Buttons */}
                        <div className="flex items-center justify-center gap-2 w-full">
                          <button
                            onClick={toggleCamera}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition cursor-pointer"
                          >
                            <span>Hubungkan Kamera</span>
                          </button>

                          <button
                            onClick={() => scanDevices(true)}
                            className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
                            title="Refresh daftar perangkat hardware"
                          >
                            <Icon className="text-[18px]">refresh</Icon>
                          </button>
                        </div>

                        {cameraError && (
                          <p className="text-[11px] font-semibold text-red-600 mt-3">{cameraError}</p>
                        )}
                      </div>

                      {/* Bottom Info */}
                      <div className="absolute bottom-4 inset-x-6 flex items-center justify-between text-[11px] font-semibold text-slate-400 data-font pointer-events-none">
                        <span>{activeCameraSpecs ? `${activeCameraSpecs.width}x${activeCameraSpecs.height}` : 'HD CAMERA'}</span>
                        <span>STATUS: {cameraStatus.toUpperCase()}</span>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* TOP-RIGHT: Weather Card */}
            <div className="col-span-12 lg:col-span-3 h-full min-h-0 flex flex-col">
              <div className="bento-card flex flex-1 h-full min-h-0 flex-col justify-between p-3.5 sm:p-4 gap-2 rounded-2xl">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
                  <span className="text-xs font-bold text-slate-600 tracking-wider uppercase">TODAY'S WEATHER</span>
                  <span className="text-xs font-bold text-slate-400 data-font">{weather.sector}</span>
                </div>

                <div className="flex flex-col items-center justify-center text-center my-auto py-1">
                  <div className="relative mb-1 flex items-center justify-center">
                    <svg className="w-32 h-26 sm:w-36 sm:h-28 drop-shadow-md" viewBox="0 0 120 100" fill="none">
                      <circle cx="60" cy="50" r="24" fill="url(#sunOnlyGrad)" />
                      <circle cx="60" cy="50" r="32" stroke="#fbbf24" strokeWidth="2" strokeDasharray="3 6" opacity="0.8" />
                      <defs>
                        <linearGradient id="sunOnlyGrad" x1="36" y1="26" x2="84" y2="74" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#fde047" />
                          <stop offset="0.6" stopColor="#f59e0b" />
                          <stop offset="1" stopColor="#ea580c" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  <div className="flex items-baseline justify-center gap-1">
                    <span className="data-font text-5xl sm:text-6xl font-black text-slate-900 tracking-tight leading-none">
                      {weather.temperature}
                    </span>
                    <span className="text-2xl font-bold text-slate-400">°C</span>
                  </div>
                  <p className="mt-1 text-sm sm:text-base font-extrabold text-slate-800">{weather.condition}</p>
                </div>

                <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 shrink-0">
                  <div className="bento-subcard p-2 sm:p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Icon className="text-[18px] text-slate-500 shrink-0">air</Icon>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                          WIND SPEED
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="data-font text-xs sm:text-sm font-bold text-slate-900">{weather.windSpeed} m/s</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 data-font">
                      <Icon className="text-[14px] text-slate-500">near_me</Icon>
                      <span>{weather.windDirection}° {weather.windCardinal}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Compact & Clean (Map Col 3 + Telemetry Console Col 6 + Heading Col 3) */}
          <div className="grid grid-cols-12 gap-3 lg:gap-3.5 h-full min-h-0">
            {/* BOTTOM-LEFT: Mini Map Card */}
            <div className="col-span-12 md:col-span-4 lg:col-span-3 h-full min-h-0 flex flex-col">
              <div
                className="bento-card relative flex flex-1 h-full min-h-0 flex-col overflow-hidden rounded-2xl group transition"
              >
                <div ref={mapRef} className="absolute inset-0 z-0 h-full w-full" />
                
                {/* Top Controls Overlay: Clean Map Style Selector & Expand Button */}
                <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-center justify-between pointer-events-none">
                  {/* Clean Style Selector (Solid White) */}
                  <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg bg-white p-1 shadow-md border border-slate-200">
                    <button
                      type="button"
                      onClick={() => onMapStyleChange?.('standard')}
                      className={`rounded-md px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                        mapStyle === 'standard'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Peta Standard (OSM)"
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => onMapStyleChange?.('satellite')}
                      className={`rounded-md px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                        mapStyle === 'satellite'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Peta Satelit"
                    >
                      Satelit
                    </button>
                    <button
                      type="button"
                      onClick={() => onMapStyleChange?.('terrain')}
                      className={`rounded-md px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                        mapStyle === 'terrain'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Peta Topografi"
                    >
                      Topografi
                    </button>
                  </div>

                  {/* Top-Right Quick Expand Button (Navigates to full map) */}
                  <button
                    type="button"
                    onClick={() => onNavigate('map')}
                    className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-700 shadow-md hover:bg-slate-900 hover:text-white transition border border-slate-200 cursor-pointer"
                    title="Buka Map Lengkap"
                  >
                    <Icon className="text-[16px]">open_in_new</Icon>
                  </button>
                </div>

                {/* Dashboard Mini-Map Zoom In / Zoom Out Controls */}
                <div className="pointer-events-auto absolute right-2.5 top-12 z-20 flex flex-col rounded-lg bg-white shadow-md border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => leafletRef.current?.zoomIn()}
                    className="flex items-center justify-center w-7 h-7 text-slate-700 hover:bg-slate-900 hover:text-white border-b border-slate-200 transition cursor-pointer active:scale-95"
                    title="Zoom In (+)"
                  >
                    <Icon className="text-[16px]">add</Icon>
                  </button>
                  <button
                    type="button"
                    onClick={() => leafletRef.current?.zoomOut()}
                    className="flex items-center justify-center w-7 h-7 text-slate-700 hover:bg-slate-900 hover:text-white transition cursor-pointer active:scale-95"
                    title="Zoom Out (-)"
                  >
                    <Icon className="text-[16px]">remove</Icon>
                  </button>
                </div>

                <div className="absolute bottom-2.5 inset-x-2.5 z-20 rounded-lg bg-white p-2.5 shadow-md border border-slate-200 flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Drone Location</span>
                    <p className="text-xs font-bold text-slate-900 truncate" title={weather.locationName}>
                      {weather.locationName}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 data-font">{telemetry.satellites} Sats</span>
                </div>
              </div>
            </div>

            {/* BOTTOM-CENTER: Flight Dynamics & MAVLink Telemetry Console */}
            <div className="col-span-12 md:col-span-8 lg:col-span-6 h-full min-h-0 flex flex-col">
              <div className="bento-card flex flex-1 h-full min-h-0 flex-col justify-between p-3.5 sm:p-4 gap-2.5 rounded-2xl">
                {/* Top Header: Battery + MAVLink Mode & Heartbeat */}
                <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100 shrink-0">
                  {/* Horizontal Battery Gauge */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">BATTERY</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 data-font">
                      <svg className="w-5 h-3 text-emerald-600 shrink-0" viewBox="0 0 24 14" fill="currentColor">
                        <rect x="1" y="1" width="19" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                        <rect x="3" y="3" width={Math.max(2, (15 * (telemetry.battery || 74)) / 100)} height="8" rx="1" fill="currentColor" />
                        <path d="M21 4.5V9.5C21.8 9.5 22.5 8.8 22.5 8V6C22.5 5.2 21.8 4.5 21 4.5Z" fill="currentColor" />
                      </svg>
                      <span>{telemetry.battery}%</span>
                      <span className="text-[11px] text-slate-400 font-medium">({telemetry.voltage}V)</span>
                    </div>
                  </div>
                </div>

                {/* 4 Telemetry Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0 items-stretch">
                  {/* Metric 1: Altitude */}
                  <div className="bento-subcard p-2.5 sm:p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">ALTITUDE</span>
                      <Icon className="text-[18px] text-slate-400">height</Icon>
                    </div>
                    <div className="flex items-baseline gap-1 my-0.5">
                      <span className="data-font text-2xl sm:text-3xl font-black text-slate-900 leading-none">{telemetry.altitude}</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-400">m</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-100">
                      <span>MAVLink Global Position</span>
                      <span className="text-slate-600 font-medium">Relative</span>
                    </div>
                  </div>

                  {/* Metric 2: Ground Speed */}
                  <div className="bento-subcard p-2.5 sm:p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">GROUND SPEED</span>
                      <Icon className="text-[18px] text-slate-400">speed</Icon>
                    </div>
                    <div className="flex items-baseline gap-1 my-0.5">
                      <span className="data-font text-2xl sm:text-3xl font-black text-slate-900 leading-none">{telemetry.speed}</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-400">m/s</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-100">
                      <span className="data-font font-bold text-slate-700">{(telemetry.speed * 3.6).toFixed(1)} km/h</span>
                      <span className="text-slate-600 font-medium">VFR HUD</span>
                    </div>
                  </div>

                  {/* Metric 3: Attitude Pitch & Roll */}
                  <div className="bento-subcard p-2.5 sm:p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">ATTITUDE</span>
                      <Icon className="text-[18px] text-slate-400">screen_rotation</Icon>
                    </div>
                    <div className="flex items-center justify-between my-0.5">
                      <div className="text-center">
                        <span className="text-[9px] font-bold text-slate-400 block">PITCH</span>
                        <span className="data-font text-base sm:text-lg font-black text-slate-900">{telemetry.pitch}°</span>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <div className="text-center">
                        <span className="text-[9px] font-bold text-slate-400 block">ROLL</span>
                        <span className="data-font text-base sm:text-lg font-black text-slate-900">{telemetry.roll}°</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-100">
                      <span>MAVLink #30 ATTITUDE</span>
                      <span className="text-slate-600 font-medium">3D Gyro</span>
                    </div>
                  </div>

                  {/* Metric 4: GPS Coordinates */}
                  <div className="bento-subcard p-2.5 sm:p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">GPS FIX & SATS</span>
                      <Icon className="text-[18px] text-slate-400">satellite_alt</Icon>
                    </div>
                    <div className="my-0.5">
                      <p className="data-font text-xs sm:text-sm font-black text-slate-900 truncate">
                        {telemetry.latitude.toFixed(5)}, {telemetry.longitude.toFixed(5)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-100">
                      <span>{telemetry.satellites} Satellites</span>
                      <span className="text-slate-600 font-medium">{telemetry.gpsFix}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM-RIGHT: Drone Heading */}
            <div className="col-span-12 md:col-span-12 lg:col-span-3 h-full min-h-0 flex flex-col">
              <div className="bento-card flex flex-1 h-full min-h-0 flex-col items-center justify-between p-3.5 sm:p-4 text-center gap-1 rounded-2xl">
                <div className="flex items-center justify-between w-full pb-1 border-b border-slate-100 shrink-0">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">HEADING</span>
                  <span className="data-font text-xs font-bold text-slate-700">
                    {telemetry.heading}° {degreesToCardinal(telemetry.heading)}
                  </span>
                </div>

                <div className="relative my-auto flex h-[105px] w-[105px] sm:h-[114px] sm:w-[114px] items-center justify-center">
                  <div
                    className="absolute inset-0 transition-transform duration-700 ease-out"
                    style={{ transform: `rotate(${-telemetry.heading}deg)` }}
                  >
                    <svg className="h-full w-full" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r="64" stroke="#e2e8f0" strokeWidth="1.2" fill="none" />
                      <circle cx="70" cy="70" r="54" stroke="#f1f5f9" strokeWidth="1" fill="none" />
                      <text x="70" y="24" textAnchor="middle" fill="#ef4444" fontSize="13" fontWeight="900">N</text>
                      <text x="122" y="74" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="800">E</text>
                      <text x="70" y="126" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="800">S</text>
                      <text x="18" y="74" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="800">W</text>
                    </svg>
                  </div>

                  <div className="pointer-events-none z-10 flex items-center justify-center">
                    <svg className="h-9 w-9 text-slate-800 drop-shadow-sm" viewBox="0 0 24 24" fill="none">
                      <polygon points="12,2 18,20 12,16 6,20" fill="#0f172a" stroke="#ffffff" strokeWidth="1.2" />
                    </svg>
                  </div>
                </div>

                <div className="w-full pt-1.5 border-t border-slate-100 flex flex-col items-center gap-0.5 shrink-0">
                  <p className="data-font text-[10px] sm:text-[11px] font-bold text-slate-700 truncate w-full" title={weather.dmsLocation}>
                    {weather.dmsLocation}
                  </p>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    MAVLINK HEADING COMPASS
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAVLink Connection Modal */}
      {showMavlinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Koneksi Telemetri MAVLink</h3>
                <p className="text-xs text-slate-500 mt-0.5">Pilih metode koneksi ke perangkat hardware atau simulator</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMavlinkModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition cursor-pointer"
              >
                <Icon className="text-[18px]">close</Icon>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3">
              {/* Option 1: Stream Telemetri Simulasi */}
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/30 transition">
                <div className="pr-3">
                  <h4 className="text-xs font-bold text-slate-900">1. Stream Telemetri Simulasi</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Generator data real-time MAVLink v2 (Heartbeat, Gyro, GPS)</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    enableMavlinkSim?.()
                    setShowMavlinkModal(false)
                  }}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Gunakan Stream
                </button>
              </div>

              {/* Option 2: WebSerial API */}
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/30 transition">
                <div className="pr-3">
                  <h4 className="text-xs font-bold text-slate-900">2. USB Serial / Pixhawk (WebSerial)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Koneksi langsung ke SiK Telemetry Radio atau kabel USB Pixhawk</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await connectSerial?.(57600)
                    setShowMavlinkModal(false)
                  }}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hubungkan USB
                </button>
              </div>

              {/* Option 3: WebSocket Server */}
              <div className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/30 transition space-y-2.5">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">3. WebSocket MAVLink Server</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Koneksi ke WebSocket MAVLink bridge (e.g. localhost:8080)</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={wsUrlInput}
                    onChange={(e) => setWsUrlInput(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-slate-500"
                    placeholder="ws://localhost:8080"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await connectWebSocket?.(wsUrlInput)
                      setShowMavlinkModal(false)
                    }}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Sambungkan
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            {connectionStatus === 'connected' && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    disconnectMavlink?.()
                    setShowMavlinkModal(false)
                  }}
                  className="rounded-lg bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 transition cursor-pointer"
                >
                  Putus Koneksi
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
