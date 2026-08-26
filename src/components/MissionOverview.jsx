import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import useCamera from '../hooks/useCamera'
import useObjectDetection from '../hooks/useObjectDetection'
import useWeather from '../hooks/useWeather'
import useDroneRegion from '../hooks/useDroneRegion'
import useTelemetryState, { getDroneLocationName } from '../hooks/useTelemetry'

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

function createStartPointIcon() {
  return L.divIcon({
    className: 'custom-start-marker',
    html: `
      <div style="width: 16px; height: 16px; border-radius: 50%; background: #22c55e; border: 2.5px solid #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.35);"></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

export default function MissionOverview({ onNavigate, telemetryState, mapStyle = 'standard', onMapStyleChange }) {
  const telemetry = telemetryState?.telemetry || {
    latitude: -7.5950,
    longitude: 110.4485,
    altitude: null,
    speed: null,
    heading: null,
    pitch: null,
    roll: null,
    yaw: 285,
    battery: null,
    voltage: null,
    current: null,
    satellites: null,
    distanceFromHome: null,
    gpsFix: 'Waiting GPS',
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
    connectBetaflightMsp,
    connectElrsCrsf,
    connectWebSocket,
    enableMavlinkSim,
    capturePhoto,
    markLocation,
    currentMission,
    disconnect: disconnectMavlink,
  } = telemetryState || {}
  const targetPoints = currentMission?.targetPoints || []
  const headingAngleRef = useRef(0)
  const disconnectTimerRef = useRef(null)
  const [headingAngle, setHeadingAngle] = useState(0)

  useEffect(() => {
    if (telemetry.heading == null) {
      headingAngleRef.current = 0
      setHeadingAngle(0)
      return
    }
    const current = headingAngleRef.current
    const diff = ((telemetry.heading - current + 540) % 360) - 180
    const next = current + diff
    headingAngleRef.current = next
    setHeadingAngle(next)
  }, [telemetry.heading])

  useEffect(() => () => clearTimeout(disconnectTimerRef.current), [])

  const weather = useWeather(telemetry.latitude, telemetry.longitude)
  const droneLocationName = useDroneRegion(telemetry.latitude, telemetry.longitude)
  
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
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [showForceRefresh, setShowForceRefresh] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [wsUrlInput, setWsUrlInput] = useState('ws://localhost:8080')
  const [isCameraDropdownOpen, setIsCameraDropdownOpen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFullscreenMap, setShowFullscreenMap] = useState(true)
  const [miniMapPos, setMiniMapPos] = useState({ x: null, y: null })
  const [isDraggingMap, setIsDraggingMap] = useState(false)
  const [captureFeedback, setCaptureFeedback] = useState(false)
  const [locationFeedback, setLocationFeedback] = useState(false)
  const dragStartPos = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 })
  const hideTimerRef = useRef(null)

  const handleSearchLocation = async (q) => {
    setLocationQuery(q)
    if (!q || q.length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.results || [])
      }
    } catch {
      // fallback
    } finally {
      setIsSearching(false)
    }
  }

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
  const [panelWidth, setPanelWidth] = useState(0)

  useEffect(() => {
    if (!videoPanelRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect) {
        setPanelWidth(entry.contentRect.width)
      }
    })
    observer.observe(videoPanelRef.current)
    return () => observer.disconnect()
  }, [])

  const isCompactCamera = panelWidth > 0 && panelWidth < 680
  const videoFrameRef = useRef(null)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const markerRef = useRef(null)
  const startMarkerRef = useRef(null)
  const pathRef = useRef(null)
  const baseLayerRef = useRef(null)
  const overlayLayerRef = useRef(null)
  const markedMarkersRef = useRef([])
  const targetMarkersRef = useRef([])

  const fullscreenMapRef = useRef(null)
  const fullscreenLeafletRef = useRef(null)
  const fullscreenMarkerRef = useRef(null)
  const fullscreenStartMarkerRef = useRef(null)
  const fullscreenPathRef = useRef(null)
  const fullscreenBaseLayerRef = useRef(null)
  const fullscreenOverlayLayerRef = useRef(null)
  const fullscreenMarkedMarkersRef = useRef([])
  const fullscreenTargetMarkersRef = useRef([])

  const [overlayVersion, setOverlayVersion] = useState(0)

  const handleCapturePhoto = () => {
    const video = videoRef.current
    if (!video || cameraStatus !== 'connected' || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    if (aiActive) {
      context.lineWidth = Math.max(3, Math.round(canvas.width / 320))
      context.font = `bold ${Math.max(16, Math.round(canvas.width / 48))}px sans-serif`
      detections.forEach(({ bbox, score }) => {
        const [x, y, width, height] = bbox
        const label = `PERSON ${Math.round(score * 100)}%`
        const labelHeight = Math.max(24, Math.round(canvas.width / 28))
        context.strokeStyle = '#10b981'
        context.fillStyle = 'rgba(16, 185, 129, 0.15)'
        context.fillRect(x, y, width, height)
        context.strokeRect(x, y, width, height)
        context.fillStyle = '#10b981'
        context.fillRect(x, Math.max(0, y - labelHeight), context.measureText(label).width + 16, labelHeight)
        context.fillStyle = '#ffffff'
        context.fillText(label, x + 8, Math.max(labelHeight - 7, y - 7))
      })
    }
    if (capturePhoto?.(canvas.toDataURL('image/jpeg', 0.85), detections.map(({ score }) => ({ label: 'PERSON', confidence: Math.round(score * 100) })))) {
      setCaptureFeedback(true)
      setTimeout(() => setCaptureFeedback(false), 160)
    }
  }

  const handleMarkLocation = () => {
    if (markLocation?.()) {
      setLocationFeedback(true)
      setTimeout(() => setLocationFeedback(false), 1200)
    }
  }

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
  }, [cameraStatus, aiActive, detections, overlayVersion, videoRef, isFullscreen])

  const trailRef = useRef([])

  // Reset flight trail map polyline (clears previous flight path history)
  const resetMapTrail = useCallback(() => {
    trailRef.current = []
    if (pathRef.current) {
      pathRef.current.setLatLngs([])
    }
    if (fullscreenPathRef.current) {
      fullscreenPathRef.current.setLatLngs([])
    }
  }, [])

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
      color: '#0284c7',
      weight: 3.5,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map)

    startMarkerRef.current = L.marker(initialPos, { icon: createStartPointIcon() }).addTo(map)

    const customIcon = createDroneHeadingIcon(telemetry.heading || 0, 28)

    markerRef.current = L.marker(initialPos, { icon: customIcon }).addTo(map)
    leafletRef.current = map

    return () => {
      map.remove()
      leafletRef.current = null
      markerRef.current = null
      startMarkerRef.current = null
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

  useEffect(() => {
    if (!leafletRef.current) return
    markedMarkersRef.current.forEach((marker) => marker.remove())
    markedMarkersRef.current = (currentMission?.markedLocations || []).map((location) => L.marker(location.coordinate, {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:25px;height:25px;border-radius:50%;background:#dc2626;border:3px solid white;box-shadow:0 2px 8px #0f172a55;color:white;display:grid;place-items:center"><span class="material-symbols-outlined" style="font-size:15px">location_on</span></div>',
        iconSize: [25, 25],
        iconAnchor: [12.5, 12.5],
      }),
    }).addTo(leafletRef.current))
    return () => {
      markedMarkersRef.current.forEach((marker) => marker.remove())
      markedMarkersRef.current = []
    }
  }, [currentMission?.markedLocations])

  useEffect(() => {
    if (!leafletRef.current) return
    targetMarkersRef.current.forEach((marker) => marker.remove())
    targetMarkersRef.current = targetPoints.map((point) => L.marker([point.lat, point.lon], {
      icon: L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:4px;background:#dc2626;border:2px solid white;box-shadow:0 2px 6px #0f172a55;color:white;display:grid;place-items:center"><span class="material-symbols-outlined" style="font-size:13px">location_on</span></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
    }).bindTooltip(point.name).addTo(leafletRef.current))
    return () => targetMarkersRef.current.forEach((marker) => marker.remove())
  }, [targetPoints])

  // Update map marker position & heading
  useEffect(() => {
    if (!leafletRef.current || !markerRef.current || !telemetry.latitude || !telemetry.longitude) return
    const newPos = [telemetry.latitude, telemetry.longitude]
    markerRef.current.setLatLng(newPos)
    markerRef.current.setIcon(createDroneHeadingIcon(telemetry.heading || 0, 28))

    const isFirstFix = trailRef.current.length === 0
    const lastPos = trailRef.current[trailRef.current.length - 1]

    if (isFirstFix) {
      trailRef.current = [newPos]
      if (startMarkerRef.current) {
        startMarkerRef.current.setLatLng(newPos)
      }
      leafletRef.current.setView(newPos, 15, { animate: true })
    } else {
      const dLat = lastPos[0] - newPos[0]
      const dLon = lastPos[1] - newPos[1]
      const jumpDist = Math.sqrt(dLat * dLat + dLon * dLon)

      if (jumpDist > 0.005) {
        // Teleportation / Initial jump reset
        trailRef.current = [newPos]
        if (startMarkerRef.current) {
          startMarkerRef.current.setLatLng(newPos)
        }
        leafletRef.current.setView(newPos, 15, { animate: true })
      } else if (jumpDist > 0.00001) {
        trailRef.current.push(newPos)
        leafletRef.current.panTo(newPos, { animate: true, duration: 0.8 })
      }
    }

    if (startMarkerRef.current && trailRef.current[0]) {
      startMarkerRef.current.setLatLng(trailRef.current[0])
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
        fullscreenStartMarkerRef.current = null
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

    const currentPos = [telemetry.latitude || -7.5950, telemetry.longitude || 110.4485]
    const startPos = trailRef.current[0] || currentPos
    const map = L.map(fullscreenMapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
    }).setView(currentPos, 14)

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

    fullscreenMarkerRef.current = L.marker(currentPos, { icon: customIcon }).addTo(map)
    fullscreenStartMarkerRef.current = L.marker(startPos, { icon: createStartPointIcon() }).addTo(map)
    fullscreenPathRef.current = L.polyline(trailRef.current, {
      color: '#0284c7',
      weight: 3.5,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map)

    fullscreenLeafletRef.current = map
    setTimeout(() => map.invalidateSize(), 150)

    return () => {
      map.remove()
      fullscreenLeafletRef.current = null
      fullscreenMarkerRef.current = null
      fullscreenStartMarkerRef.current = null
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

  useEffect(() => {
    if (!fullscreenLeafletRef.current) return
    fullscreenMarkedMarkersRef.current.forEach((marker) => marker.remove())
    fullscreenMarkedMarkersRef.current = (currentMission?.markedLocations || []).map((location) => L.marker(location.coordinate, {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:25px;height:25px;border-radius:5px;background:#dc2626;border:3px solid white;box-shadow:0 2px 8px #0f172a55;color:white;display:grid;place-items:center"><span class="material-symbols-outlined" style="font-size:15px">location_on</span></div>',
        iconSize: [25, 25],
        iconAnchor: [12.5, 12.5],
      }),
    }).addTo(fullscreenLeafletRef.current))
    return () => {
      fullscreenMarkedMarkersRef.current.forEach((marker) => marker.remove())
      fullscreenMarkedMarkersRef.current = []
    }
  }, [currentMission?.markedLocations, isFullscreen, showFullscreenMap])

  useEffect(() => {
    if (!fullscreenLeafletRef.current) return
    fullscreenTargetMarkersRef.current.forEach((marker) => marker.remove())
    fullscreenTargetMarkersRef.current = targetPoints.map((point) => L.marker([point.lat, point.lon], {
      icon: L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:4px;background:#dc2626;border:2px solid white;box-shadow:0 2px 6px #0f172a55;color:white;display:grid;place-items:center"><span class="material-symbols-outlined" style="font-size:13px">location_on</span></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
    }).bindTooltip(point.name).addTo(fullscreenLeafletRef.current))
    return () => fullscreenTargetMarkersRef.current.forEach((marker) => marker.remove())
  }, [targetPoints, isFullscreen, showFullscreenMap])

  // Update fullscreen map position & heading
  useEffect(() => {
    if (!fullscreenLeafletRef.current || !fullscreenMarkerRef.current || !telemetry.latitude || !telemetry.longitude) return
    const newPos = [telemetry.latitude, telemetry.longitude]
    fullscreenMarkerRef.current.setLatLng(newPos)
    fullscreenMarkerRef.current.setIcon(createDroneHeadingIcon(telemetry.heading || 0, 28))
    fullscreenLeafletRef.current.panTo(newPos, { animate: true, duration: 0.8 })
    if (fullscreenStartMarkerRef.current && trailRef.current[0]) {
      fullscreenStartMarkerRef.current.setLatLng(trailRef.current[0])
    }
    if (fullscreenPathRef.current && trailRef.current.length > 0) {
      fullscreenPathRef.current.setLatLngs(trailRef.current)
    }
  }, [telemetry.latitude, telemetry.longitude, telemetry.heading, isFullscreen, showFullscreenMap])

  return (
    <main className="ml-[72px] flex-1 flex flex-col h-screen lg:overflow-hidden overflow-y-auto bg-[#f5f7fa] text-[#0f172a]">
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
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 cursor-pointer"
          >
            <span className="font-medium">
              Telemetry <span className="text-slate-400">/</span> <strong className="font-semibold text-slate-800">{connectionStatus === 'connected' ? connectionType.toUpperCase() : 'Disconnected'}</strong>
            </span>
          </button>
        </div>
      </header>

      {/* Main Bento Grid Canvas */}
      <div className="flex-1 min-h-0 lg:overflow-hidden p-2.5 sm:p-3 lg:p-3.5 flex flex-col">
        <div className="dashboard-grid-container mx-auto max-w-[1700px] gap-2 lg:gap-2.5 flex-1 w-full min-h-0">
          {/* TOP ROW: Responsive Dual-Mode (16:10 2-Column vs 16:9 3-Column Centered) */}
          <div className="top-row-layout gap-2.5 lg:gap-3 shrink-0 min-h-0">
            {/* Left Flank for 16:9 Layout Mode: Weather Card */}
            <div className="weather-dock-16-9 bento-card flex-1 min-h-0 flex-col p-3 sm:p-3.5 rounded-2xl justify-between gap-2.5 shadow-xs overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
                <div>
                  <span className="text-[10px] font-black text-slate-900 tracking-wider uppercase block leading-none">Weather</span>
                  <span className="text-[8px] font-semibold text-slate-400 block mt-0.5">Flight Environment</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="group inline-flex min-w-0 max-w-[170px] items-center gap-1 transition cursor-pointer text-right bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs active:scale-95"
                  title="Click to change location"
                >
                  <Icon className="text-[13px] text-slate-400 group-hover:text-slate-700 transition">location_on</Icon>
                  <span className="truncate text-[9px] font-bold text-slate-700 group-hover:text-slate-950">
                    {weather.locationName}
                  </span>
                </button>
              </div>

              {/* Hero Temperature & Condition Section (Exact 50% Top Half) */}
              <div className="flex-1 basis-1/2 min-h-0 flex flex-col justify-between bg-slate-50 border border-slate-100 p-3 sm:p-3.5 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 my-auto">
                  <div className="flex items-center gap-2.5">
                    <svg className="h-10 w-10 sm:h-12 sm:w-12 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
                    </svg>
                    <div className="flex items-baseline gap-1">
                      <span className="data-font text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
                        {weather.temperature}
                      </span>
                      <span className="text-sm font-bold text-slate-400">°C</span>
                    </div>
                  </div>

                  <div className="text-right min-w-0">
                    <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{weather.condition}</p>
                    {weather.apparentTemperature && (
                      <span className="inline-block text-[9px] font-bold text-slate-600 bg-white border border-slate-200/80 px-2 py-0.5 rounded-md mt-1 shadow-2xs">
                        Feels like {weather.apparentTemperature}°C
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Environmental Metrics Section (Exact 50% Bottom Half - Immune to clipping) */}
              <div className="flex-1 basis-1/2 min-h-0 flex flex-col gap-1.5 justify-between">
                {/* Upper Row: Humidity & Wind Dir (2 Columns) */}
                <div className="flex-1 min-h-0 grid grid-cols-2 gap-1.5">
                  <div className="bento-subcard p-2 sm:p-2.5 flex flex-col justify-between border border-slate-200 h-full min-h-0">
                    <div className="flex items-center justify-between text-[9px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">
                      <span>Humidity</span>
                      <Icon className="text-[13px] text-slate-500">water_drop</Icon>
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-1">
                      <span className="data-font text-xs sm:text-sm font-black text-slate-900 leading-none">{weather.humidity || 60}%</span>
                      <span className="text-[8px] sm:text-[9px] font-semibold text-slate-400 leading-none">Relative</span>
                    </div>
                  </div>

                  <div className="bento-subcard p-2 sm:p-2.5 flex flex-col justify-between border border-slate-200 h-full min-h-0">
                    <div className="flex items-center justify-between text-[9px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">
                      <span>Wind Dir</span>
                      <Icon className="text-[13px] text-slate-500">explore</Icon>
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-1">
                      <span className="data-font text-xs sm:text-sm font-black text-slate-900 leading-none">{weather.windDirection}°</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase leading-none">{weather.windCardinal}</span>
                    </div>
                  </div>
                </div>

                {/* Lower Row: Wind Speed (Full Width) */}
                <div className="flex-1 min-h-0 bento-subcard p-2 sm:p-2.5 flex flex-col justify-between border border-slate-200 h-full min-h-0">
                  <div className="flex items-center justify-between text-[9px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">
                    <span>Wind Speed</span>
                    <Icon className="text-[13px] text-slate-500">air</Icon>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <div className="flex items-baseline gap-1">
                      <span className="data-font text-sm sm:text-base font-black text-slate-900 leading-none">{weather.windSpeed}</span>
                      <span className="text-[10px] font-bold text-slate-400 leading-none">m/s</span>
                    </div>
                    <span className="inline-block text-[8px] sm:text-[9px] font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-md data-font leading-none shrink-0">
                      {weather.windSpeedKmH || (weather.windSpeed * 3.6).toFixed(1)} km/h
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER / LEFT: Main Drone Camera Viewfinder Feed (Fixed 4:3 Aspect Ratio) */}
            <div
              ref={videoPanelRef}
              onMouseMove={handleVideoMouseMove}
              onMouseLeave={handleVideoMouseLeave}
              className={`camera-top-box group relative flex aspect-[4/3] w-full shrink-0 flex-col overflow-hidden rounded-2xl ${
                cameraStatus === 'connected' ? 'bg-slate-950' : 'bg-slate-100'
              } shadow-sm border border-slate-200 [&:fullscreen]:aspect-auto [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:max-w-none [&:fullscreen]:rounded-none`}
            >
                {/* Video Frame Container */}
                <div ref={videoFrameRef} className="relative flex-1 h-full min-h-0 w-full bg-slate-950 overflow-hidden">
                  {/* Live WebCam Stream (Native Uncropped Resolution in Fullscreen) */}
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-full w-full object-cover object-center ${
                      cameraStatus === 'connected' ? 'block' : 'hidden'
                    }`}
                  />
                  {cameraStatus === 'connected' && (
                    <canvas className="pointer-events-none absolute inset-0 z-20" />
                  )}
                  {captureFeedback && (
                    <div className="pointer-events-none absolute inset-0 z-50 bg-white transition">
                      <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-xl">
                        <Icon className="text-[16px]">photo_camera</Icon>
                        <span>Photo saved</span>
                      </div>
                    </div>
                  )}
                  {locationFeedback && (
                    <div className="pointer-events-none absolute left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-xl border border-slate-800">
                      Location marked on map
                    </div>
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
                            title="Standard Street Map (OSM)"
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
                            title="Satellite Map"
                          >
                            Satellite
                          </button>
                          <button
                            type="button"
                            onClick={() => onMapStyleChange?.('terrain')}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                              mapStyle === 'terrain'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                            title="Topographic Altitude Map"
                          >
                            Terrain
                          </button>
                        </div>

                        {/* Hide Mini Map Button */}
                        <button
                          type="button"
                          onClick={() => setShowFullscreenMap(false)}
                          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-white shadow-md hover:bg-slate-800 transition border border-slate-700 cursor-pointer"
                          title="Hide Mini Map"
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
<span className="text-[8px] font-bold uppercase tracking-wide text-slate-400 block">Location</span>
                          <p className="text-[11px] font-bold text-slate-900 truncate" title={droneLocationName}>
                            {droneLocationName}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 data-font">{telemetry.satellites ?? '--'} Sats</span>
                      </div>
                    </div>
                  )}

                  {/* Floating Video Control Overlays (Auto-hides on idle) */}
                  {cameraStatus === 'connected' && (
                    <>
                      {/* Camera Selector & Fullscreen Control Overlay */}
                      <div
                        className={`z-30 flex items-center gap-1.5 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-1 shadow-xl w-max max-w-[calc(100%-1.25rem)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-all duration-300 ${
                          isCompactCamera
                            ? 'absolute top-2.5 left-1/2 -translate-x-1/2'
                            : 'absolute bottom-2.5 right-2.5'
                        } ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                      >
                        {/* Camera Switcher Selector */}
                        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-xs font-medium text-slate-200">
                          <select
                            value={selectedDeviceId}
                            onChange={(e) => selectCamera(e.target.value)}
                            className="min-w-0 bg-slate-800 text-[11px] font-semibold text-white focus:outline-none cursor-pointer max-w-[110px] truncate"
                          >
                            {devices.length > 0 ? (
                              devices.map((dev, idx) => (
                                <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-slate-900 text-white">
                                  {dev.label}
                                </option>
                              ))
                            ) : (
                              <option value="" className="bg-slate-900 text-white">
                                {activeCameraSpecs?.label || 'Hardware Camera Detected'}
                              </option>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => scanDevices(true)}
                            className="text-slate-400 hover:text-white transition cursor-pointer"
                            title="Rescan camera devices"
                          >
                            <Icon className="text-[14px]">refresh</Icon>
                          </button>
                        </div>

                        {/* Toggle Fullscreen Mini-Map Button */}
                        {isFullscreen && (
                          <button
                            type="button"
                            onClick={() => setShowFullscreenMap((v) => !v)}
                            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition shrink-0 cursor-pointer ${
                              showFullscreenMap
                                ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
                                : 'bg-emerald-600 text-white shadow-xs'
                            }`}
                            title={showFullscreenMap ? 'Hide Mini Map' : 'Show Mini Map'}
                          >
                            <Icon className="text-[14px]">map</Icon>
                            <span>{showFullscreenMap ? 'Hide Map' : 'Show Map'}</span>
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

                      {/* Disconnect, AI Detect & Action Controls Overlay */}
                      <div
                        className={`z-30 flex items-center gap-1.5 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-1 shadow-xl w-max max-w-[calc(100%-1.25rem)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-all duration-300 ${
                          isCompactCamera
                            ? 'absolute bottom-2.5 left-1/2 -translate-x-1/2'
                            : 'absolute bottom-2.5 left-2.5'
                        } ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                      >
                        {/* Stop Camera Button */}
                        <button
                          type="button"
                          onClick={toggleCamera}
                          className="flex items-center gap-1 rounded-md bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 text-[11px] font-bold transition shrink-0 cursor-pointer shadow-xs"
                          title="Disconnect Camera Stream"
                        >
                          <Icon className="text-[14px]">videocam_off</Icon>
                          <span>Disconnect</span>
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

                        {/* Capture Photo Button */}
                        <button
                          type="button"
                          onClick={handleCapturePhoto}
                          className={`flex items-center justify-center gap-1.5 rounded-md bg-sky-600 text-xs font-bold text-white transition hover:bg-sky-700 cursor-pointer ${
                            isFullscreen ? 'px-3 py-1.5' : 'px-2 py-1.5'
                          }`}
                          title="Capture current camera frame"
                        >
                          <Icon className="text-[16px]">photo_camera</Icon>
                          {isFullscreen && <span>{captureFeedback ? 'Photo saved' : 'Capture Photo'}</span>}
                        </button>

                        {/* Mark Location Button */}
                        <button
                          type="button"
                          onClick={handleMarkLocation}
                          className={`flex items-center justify-center gap-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-bold text-white transition hover:bg-slate-700 cursor-pointer ${
                            isFullscreen ? 'px-3 py-1.5' : 'px-2 py-1.5'
                          }`}
                          title="Mark current drone location"
                        >
                          <Icon className="text-[16px]">location_on</Icon>
                          {isFullscreen && <span>{locationFeedback ? 'Location Marked' : 'Mark Location'}</span>}
                        </button>
                      </div>
                    </>
                  )}

                  {/* Camera Offline / Selection Standby View */}
                  {cameraStatus !== 'connected' && (
                    <div className="relative flex h-full w-full flex-col items-center justify-center bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-6 overflow-hidden">
                      {/* Top Header */}
                      <div className="absolute top-4 inset-x-6 flex items-center justify-between text-[11px] font-semibold text-slate-500 data-font pointer-events-none">
                        <span className="text-slate-700 tracking-wider font-bold">DRONE CAMERA FEED</span>
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          REAL HARDWARE INPUT ONLY
                        </span>
                      </div>

                      {/* Hardware Device Selection Box */}
                      <div className="relative z-10 flex flex-col items-center max-w-xs sm:max-w-[340px] w-full text-center bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-md">
                        {/* Camera Icon without background box */}
                        <Icon className="text-[40px] text-slate-800 mb-2">videocam</Icon>

                        <h3 className="text-sm font-extrabold text-slate-900">Hardware Camera Detected</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-4">
                          {permissionState === 'denied'
                            ? 'Camera access denied. Please grant permission in your browser.'
                            : devices.length > 0
                            ? `Detected ${devices.length} physical camera devices on your system.`
                            : 'Click the button below to scan & permit camera devices.'}
                        </p>

                        {/* Custom White Camera Dropdown Selector */}
                        {devices.length > 0 && (
                          <div className="w-full mb-4 text-left relative">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Select Physical Camera:
                            </label>
                            
                            {/* Trigger Button */}
                            <div
                              onClick={() => setIsCameraDropdownOpen((v) => !v)}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-800 shadow-sm cursor-pointer hover:border-slate-400 transition"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <Icon className="text-[18px] text-slate-600 shrink-0">videocam</Icon>
                                <span className="truncate">
                                  {devices.find((d) => d.deviceId === selectedDeviceId)?.label || 'Select Camera Device'}
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
                            <span>Connect Camera</span>
                          </button>

                          <button
                            onClick={() => scanDevices(true)}
                            className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
                            title="Rescan hardware devices"
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

            {/* RIGHT DOCK WRAPPER (FOR 16:10 MODE): Weather Card (Top) + Metrics Grid (Bottom) */}
            <div className="right-dock-wrapper-16-10 flex-col gap-2.5 lg:gap-3 h-full min-h-0">
              {/* Weather Card */}
              <div className="bento-card flex-1 min-h-0 flex flex-col p-3 sm:p-3.5 rounded-2xl justify-between gap-2.5 shadow-xs overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
                  <div>
                    <span className="text-[10px] font-black text-slate-900 tracking-wider uppercase block leading-none">Weather</span>
                    <span className="text-[8px] font-semibold text-slate-400 block mt-0.5">Flight Environment</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    className="group inline-flex min-w-0 max-w-[170px] items-center gap-1 transition cursor-pointer text-right bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs active:scale-95"
                    title="Click to change location"
                  >
                    <Icon className="text-[13px] text-slate-400 group-hover:text-slate-700 transition">location_on</Icon>
                    <span className="truncate text-[9px] font-bold text-slate-700 group-hover:text-slate-950">
                      {weather.locationName}
                    </span>
                  </button>
                </div>

                {/* Hero Temperature & Condition Section (Exact 50% Top Half) */}
                <div className="flex-1 basis-1/2 min-h-0 flex flex-col justify-between bg-slate-50 border border-slate-100 p-3 sm:p-3.5 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between gap-3 my-auto">
                    <div className="flex items-center gap-2.5">
                      <svg className="h-10 w-10 sm:h-12 sm:w-12 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
                      </svg>
                      <div className="flex items-baseline gap-1">
                        <span className="data-font text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
                          {weather.temperature}
                        </span>
                        <span className="text-sm font-bold text-slate-400">°C</span>
                      </div>
                    </div>

                    <div className="text-right min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{weather.condition}</p>
                      {weather.apparentTemperature && (
                        <span className="inline-block text-[9px] font-bold text-slate-600 bg-white border border-slate-200/80 px-2 py-0.5 rounded-md mt-1 shadow-2xs">
                          Feels like {weather.apparentTemperature}°C
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Environmental Metrics Section (16:10 Mode: Horizontal 3-Column Grid) */}
                <div className="grid grid-cols-3 gap-2 shrink-0">
                  {/* Metric 1: Wind Speed */}
                  <div className="bento-subcard p-3 sm:p-3.5 flex flex-col justify-between border border-slate-200 min-h-[86px] sm:min-h-[94px]">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">
                      <span>Wind Speed</span>
                      <Icon className="text-[16px] text-slate-500">air</Icon>
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-1">
                      <div className="flex items-baseline gap-1">
                        <span className="data-font text-base sm:text-lg font-black text-slate-900 leading-none">{weather.windSpeed}</span>
                        <span className="text-[10px] font-bold text-slate-400 leading-none">m/s</span>
                      </div>
                      <span className="inline-block text-[9px] sm:text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-md data-font leading-none shrink-0">
                        {weather.windSpeedKmH || (weather.windSpeed * 3.6).toFixed(1)} km/h
                      </span>
                    </div>
                  </div>

                  {/* Metric 2: Wind Dir */}
                  <div className="bento-subcard p-3 sm:p-3.5 flex flex-col justify-between border border-slate-200 min-h-[86px] sm:min-h-[94px]">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">
                      <span>Wind Dir</span>
                      <Icon className="text-[16px] text-slate-500">explore</Icon>
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-1">
                      <span className="data-font text-base sm:text-lg font-black text-slate-900 leading-none">{weather.windDirection}°</span>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase leading-none">{weather.windCardinal}</span>
                    </div>
                  </div>

                  {/* Metric 3: Humidity */}
                  <div className="bento-subcard p-3 sm:p-3.5 flex flex-col justify-between border border-slate-200 min-h-[86px] sm:min-h-[94px]">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">
                      <span>Humidity</span>
                      <Icon className="text-[16px] text-slate-500">water_drop</Icon>
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-1">
                      <span className="data-font text-base sm:text-lg font-black text-slate-900 leading-none">{weather.humidity || 60}%</span>
                      <span className="text-[10px] font-semibold text-slate-400 leading-none">Relative</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 lg:gap-3 flex-1 min-h-0">
                <div className="bento-card flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl min-h-0 overflow-hidden shadow-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
                    <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">ALTITUDE</span>
                    <Icon className="text-[16px] text-slate-400">unfold_more</Icon>
                  </div>
                  <div className="my-auto py-1 flex flex-col items-center justify-center text-center gap-1">
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="data-font text-4xl sm:text-5xl font-extrabold text-slate-900 leading-none tracking-tight">
                        {telemetry.altitude == null ? '--' : telemetry.altitude.toFixed(2)}
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-slate-400">m</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">Relative Altitude</p>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[9px] font-bold text-slate-400 shrink-0">
                    <span>FC ESTIMATE</span>
                    <span className="text-slate-700 font-semibold uppercase">RELATIVE</span>
                  </div>
                </div>

                <div className="bento-card flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl min-h-0 overflow-hidden shadow-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
                    <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">GROUND SPEED</span>
                    <Icon className="text-[16px] text-slate-400">speed</Icon>
                  </div>
                  <div className="my-auto py-1 flex flex-col items-center justify-center text-center gap-1">
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="data-font text-4xl sm:text-5xl font-extrabold text-slate-900 leading-none tracking-tight">
                        {telemetry.speed ?? '--'}
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-slate-400">m/s</span>
                    </div>
                    <span className="inline-block text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-md mt-0.5 data-font shadow-2xs">
                        {telemetry.speed == null ? '--' : `${(telemetry.speed * 3.6).toFixed(1)} km/h`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[9px] font-bold text-slate-400 shrink-0">
                    <span>HUD SPEED</span>
                    <span className="text-slate-700 font-semibold uppercase">LIVE STREAM</span>
                  </div>
                </div>
              </div>
            </div>

            {/* METRICS DOCK (FOR 16:9 MODE): Altitude Card (Top) + Ground Speed Card (Bottom) Stacked */}
            <div className="metrics-dock-16-9 flex-1 min-h-0 flex-col gap-2.5 lg:gap-3 h-full justify-between">
              <div className="bento-card flex-1 flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl min-h-0 overflow-hidden shadow-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
                  <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">ALTITUDE</span>
                  <Icon className="text-[16px] text-slate-400">unfold_more</Icon>
                </div>
                <div className="my-auto py-1 flex flex-col items-center justify-center text-center gap-1">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="data-font text-3xl sm:text-4xl font-extrabold text-slate-900 leading-none tracking-tight">
                      {telemetry.altitude == null ? '--' : telemetry.altitude.toFixed(2)}
                    </span>
                    <span className="text-sm font-extrabold text-slate-400">m</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Relative Altitude</p>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[9px] font-bold text-slate-400 shrink-0">
                  <span>FC ESTIMATE</span>
                  <span className="text-slate-700 font-semibold uppercase">RELATIVE</span>
                </div>
              </div>

              <div className="bento-card flex-1 flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl min-h-0 overflow-hidden shadow-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
                  <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">GROUND SPEED</span>
                  <Icon className="text-[16px] text-slate-400">speed</Icon>
                </div>
                <div className="my-auto py-1 flex flex-col items-center justify-center text-center gap-1">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="data-font text-3xl sm:text-4xl font-extrabold text-slate-900 leading-none tracking-tight">
                      {telemetry.speed ?? '--'}
                    </span>
                    <span className="text-sm font-extrabold text-slate-400">m/s</span>
                  </div>
                  <span className="inline-block text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-md mt-0.5 data-font shadow-2xs">
                    {telemetry.speed == null ? '--' : `${(telemetry.speed * 3.6).toFixed(1)} km/h`}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[9px] font-bold text-slate-400 shrink-0">
                  <span>HUD SPEED</span>
                  <span className="text-slate-700 font-semibold uppercase">LIVE STREAM</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Aligned Grid (Matches Top Dock Columns 1:1) */}
          <div className="bottom-row-layout gap-2.5 lg:gap-3 flex-1 min-h-0">
            {/* BOTTOM-LEFT: Mini Map Card (Matches 1/2 Camera Feed Width 1:1) */}
            <div className="bottom-map-card h-full min-h-0 flex flex-col">
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
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold transition cursor-pointer ${
                        mapStyle === 'standard'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Standard Street Map (OSM)"
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => onMapStyleChange?.('satellite')}
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold transition cursor-pointer ${
                        mapStyle === 'satellite'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Satellite Map"
                    >
                      Satellite
                    </button>
                    <button
                      type="button"
                      onClick={() => onMapStyleChange?.('terrain')}
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold transition cursor-pointer ${
                        mapStyle === 'terrain'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Topographic Map"
                    >
                      Terrain
                    </button>
                  </div>

                  {/* Top-Right Quick Expand Button (Navigates to full map) */}
                  <button
                    type="button"
                    onClick={() => onNavigate('map')}
                    className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-700 shadow-md hover:bg-slate-900 hover:text-white transition border border-slate-200 cursor-pointer"
                    title="Open Full Map"
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

                <div className="absolute bottom-2 inset-x-2 z-20 rounded-lg bg-white p-2 shadow-md border border-slate-200 flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Drone Location</span>
                    <p className="text-xs font-bold text-slate-900 truncate" title={droneLocationName}>
                      {droneLocationName}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 data-font">{telemetry.satellites ?? '--'} Sats</span>
                </div>
              </div>
            </div>

            {/* BOTTOM-CENTER: Flight Dynamics Console (Matches Camera Feed Width 1:1) */}
            <div className="bottom-console-card h-full min-h-0 flex flex-col">
              <div className="bento-card flex flex-1 h-full min-h-0 flex-col p-2 sm:p-2.5 gap-1.5 rounded-2xl">
                {/* Top Header: Drone Status + Battery */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100 shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Drone Status</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-medium text-slate-500">Battery</span>
                    <div className="h-1.5 w-16 sm:w-20 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-700 transition-all"
                        style={{ width: `${telemetry.battery ?? 0}%` }}
                      />
                    </div>
                    <div className="flex items-baseline gap-1 data-font text-[10px]">
                      <span className="font-bold text-slate-900">{telemetry.battery == null ? '--' : `${telemetry.battery}%`}</span>
                      <span className="text-[10px] text-slate-400">{telemetry.voltage == null ? '--' : `${telemetry.voltage}V`}</span>
                    </div>
                  </div>
                </div>

                {/* 2 Telemetry Metrics Grid: Attitude & GPS Fix */}
                <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 auto-rows-fr">
                  {/* Metric 1: Attitude Pitch & Roll */}
                  <div className="bento-subcard min-h-0 overflow-hidden p-2 sm:p-2.5 flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">ATTITUDE</span>
                      <Icon className="text-[18px] text-slate-400">3d_rotation</Icon>
                    </div>
                    <div className="flex flex-1 items-center justify-around gap-3 my-0.5">
                      <div className="min-w-0 text-center">
                        <span className="block text-[9px] font-bold uppercase text-slate-400">Pitch</span>
                        <span className="data-font block truncate text-lg sm:text-xl font-black text-slate-900 leading-tight">{telemetry.pitch == null ? '--' : `${telemetry.pitch}°`}</span>
                      </div>
                      <div className="h-8 w-px shrink-0 bg-slate-200" />
                      <div className="min-w-0 text-center">
                        <span className="block text-[9px] font-bold uppercase text-slate-400">Roll</span>
                        <span className="data-font block truncate text-lg sm:text-xl font-black text-slate-900 leading-tight">{telemetry.roll == null ? '--' : `${telemetry.roll}°`}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-[9px] font-semibold text-slate-400">
                      <span>3D Horizon</span>
                      <span className="text-slate-600 font-bold">Pitch / Roll</span>
                    </div>
                  </div>

                  {/* Metric 2: GPS Coordinates & Satellites */}
                  <div className="bento-subcard min-h-0 overflow-hidden p-2 sm:p-2.5 flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">GPS FIX & SATS</span>
                      <Icon className="text-[18px] text-slate-400">gps_fixed</Icon>
                    </div>
                    <div className="my-0.5">
                      <p className="data-font text-sm sm:text-base font-black text-slate-900 truncate">
                        {telemetry.gpsFix === 'GPS Fix' && Number.isFinite(telemetry.latitude) && Number.isFinite(telemetry.longitude)
                          ? `${telemetry.latitude.toFixed(5)}, ${telemetry.longitude.toFixed(5)}`
                          : '--'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1 text-[9px] font-semibold text-slate-400">
                      <span className="data-font font-bold text-slate-700">{telemetry.satellites ?? '--'} Satellites</span>
                      <span className="data-font font-bold text-slate-700">Distance {telemetry.distanceFromHome || '--'}</span>
                      <span className="text-slate-600 font-bold">{telemetry.gpsFix}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM-RIGHT: Drone Heading Compass (Matches Ground Speed Width 1:1) */}
            <div className="bottom-heading-card h-full min-h-0 flex flex-col">
              <div className="bento-card flex flex-1 h-full min-h-0 flex-col items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 text-center gap-0.5 rounded-2xl overflow-hidden shadow-xs">
                <div className="flex items-center justify-between w-full pb-1 border-b border-slate-100 shrink-0">
                  <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">HEADING</span>
                  <span className="data-font text-xs font-bold text-slate-700">
                    {telemetry.heading == null ? '--' : `${telemetry.heading}°`}
                  </span>
                </div>

                <div className="relative my-auto flex h-22 w-22 sm:h-26 sm:w-26 lg:h-28 lg:w-28 items-center justify-center">
                  <div
                    className="absolute inset-0 transition-transform duration-100 ease-out"
                    style={{ transform: `rotate(${-headingAngle}deg)` }}
                  >
                    <svg className="h-full w-full" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r="64" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
                      <circle cx="70" cy="70" r="52" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" fill="none" />
                      
                      {/* Cardinal Ticks */}
                      <line x1="70" y1="6" x2="70" y2="12" stroke="#ef4444" strokeWidth="2.5" />
                      <line x1="134" y1="70" x2="128" y2="70" stroke="#64748b" strokeWidth="2" />
                      <line x1="70" y1="134" x2="70" y2="128" stroke="#64748b" strokeWidth="2" />
                      <line x1="6" y1="70" x2="12" y2="70" stroke="#64748b" strokeWidth="2" />

                      {/* Cardinal Labels */}
                      <text x="70" y="26" textAnchor="middle" fill="#ef4444" fontSize="14" fontWeight="900">N</text>
                      <text x="120" y="74" textAnchor="middle" fill="#334155" fontSize="13" fontWeight="800">E</text>
                      <text x="70" y="123" textAnchor="middle" fill="#334155" fontSize="13" fontWeight="800">S</text>
                      <text x="20" y="74" textAnchor="middle" fill="#334155" fontSize="13" fontWeight="800">W</text>
                    </svg>
                  </div>

                  <div className="pointer-events-none z-10 flex items-center justify-center">
                    <svg className="h-10 w-10 sm:h-11 sm:w-11 text-slate-900 drop-shadow-md" viewBox="0 0 24 24" fill="none">
                      <polygon points="12,2 18,20 12,16 6,20" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>

                <div className="w-full pt-1.5 border-t border-slate-100 flex flex-col items-center shrink-0">
                  <p className="data-font text-sm font-black text-slate-900">
                    {telemetry.heading == null ? '--' : `${telemetry.heading}°`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAVLink Connection Modal */}
      {showMavlinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Telemetry Connection</h3>
                <p className="text-xs text-slate-500 mt-0.5">Select connection method for hardware devices or flight simulator</p>
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
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 transition">
                <div className="pr-3">
                  <h4 className="text-xs font-bold text-slate-900">1. Simulated Telemetry Stream</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Real-time MAVLink v2 generator (Heartbeat, Gyro, GPS)</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetMapTrail()
                    enableMavlinkSim?.()
                    setShowMavlinkModal(false)
                  }}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Use Stream
                </button>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 transition">

                <div className="pr-3">
                  <h4 className="text-xs font-bold text-slate-900">2. Betaflight USB (MSP)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Read telemetry from Betaflight flight controller COM port</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    resetMapTrail()
                    const connected = await connectBetaflightMsp?.(115200)
                    if (connected) setShowMavlinkModal(false)
                  }}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Connect BF
                </button>
              </div>

              {/* Option 3: WebSerial API */}
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/30 transition">
                <div className="pr-3">
                  <h4 className="text-xs font-bold text-slate-900">3. ELRS / CRSF USB Telemetry</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Read passive telemetry from ELRS radio or CRSF serial bridge</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    resetMapTrail()
                    const connected = await connectElrsCrsf?.(420000)
                    if (connected) setShowMavlinkModal(false)
                  }}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Connect ELRS
                </button>
              </div>

              {/* Option 4: WebSerial API */}
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/30 transition">
                <div className="pr-3">
                  <h4 className="text-xs font-bold text-slate-900">4. MAVLink USB / Pixhawk</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Direct connection to SiK Telemetry Radio or Pixhawk USB cable</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    resetMapTrail()
                    await connectSerial?.(57600)
                    setShowMavlinkModal(false)
                  }}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Connect USB
                </button>
              </div>
              {/* Option 4: WebSocket Server */}
              <div className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/30 transition space-y-2.5">

                <div>
                  <h4 className="text-xs font-bold text-slate-900">5. WebSocket MAVLink Server</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Connect to MAVLink WebSocket bridge (e.g. ws://localhost:8080)</p>
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
                      resetMapTrail()
                      await connectWebSocket?.(wsUrlInput)
                      setShowMavlinkModal(false)
                    }}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Connect
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            {(connectionStatus === 'connected' || isDisconnecting) && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
                {showForceRefresh && (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    Force Refresh
                  </button>
                )}
                <button
                  type="button"
                  disabled={isDisconnecting}
                  onClick={() => {
                    resetMapTrail()
                    setIsDisconnecting(true)
                    setShowForceRefresh(false)
                    disconnectTimerRef.current = setTimeout(() => setShowForceRefresh(true), 1500)
                    Promise.resolve(disconnectMavlink?.()).finally(() => {
                      clearTimeout(disconnectTimerRef.current)
                      setIsDisconnecting(false)
                      setShowForceRefresh(false)
                      setShowMavlinkModal(false)
                    })
                  }}
                  className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs disabled:cursor-wait disabled:opacity-60"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weather Location Selector Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Set Weather Location</h3>
                <p className="text-xs text-slate-500 mt-0.5">Auto-detect GPS or search your exact city/area</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              >
                <Icon className="text-[18px]">close</Icon>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Option 1: Laptop Device GPS (Dashboard Ground Station) */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    weather.syncWithDeviceGps?.()
                    setShowLocationModal(false)
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left cursor-pointer ${
                    weather.locationMode === 'device'
                      ? 'bg-white border-2 border-emerald-600 shadow-sm'
                      : 'bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                      weather.locationMode === 'device' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      <Icon className="text-[18px]">laptop_mac</Icon>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Dashboard Device GPS (Laptop)</span>
                        {weather.locationMode === 'device' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-600 text-white uppercase tracking-wider">Active</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {weather.gpsAccuracy ? `High-accuracy Wi-Fi/GPS (±${weather.gpsAccuracy}m)` : 'Real-time ground station position'}
                      </p>
                    </div>
                  </div>
                  <Icon className={`text-[18px] ${weather.locationMode === 'device' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {weather.locationMode === 'device' ? 'check_circle' : 'chevron_right'}
                  </Icon>
                </button>

                {/* Option 2: Drone Live Coordinates Sync */}
                <button
                  type="button"
                  onClick={() => {
                    weather.syncWithDroneGps?.(telemetry.latitude, telemetry.longitude)
                    setShowLocationModal(false)
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left cursor-pointer ${
                    weather.locationMode === 'drone'
                      ? 'bg-white border-2 border-sky-600 shadow-sm'
                      : 'bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                      weather.locationMode === 'drone' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      <Icon className="text-[18px]">near_me</Icon>
                    </div>
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Sync with Drone Telemetry GPS</span>
                        {weather.locationMode === 'drone' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-600 text-white uppercase tracking-wider">Active</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {telemetry.latitude.toFixed(4)}, {telemetry.longitude.toFixed(4)} • {droneLocationName}
                      </p>
                    </div>
                  </div>
                  <Icon className={`text-[18px] ${weather.locationMode === 'drone' ? 'text-sky-600' : 'text-slate-400'}`}>
                    {weather.locationMode === 'drone' ? 'check_circle' : 'chevron_right'}
                  </Icon>
                </button>
              </div>

              {/* Search Box */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Search Location (City, District, Area):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={locationQuery}
                    onChange={(e) => handleSearchLocation(e.target.value)}
                    placeholder="e.g. Yogyakarta, Sleman, Jakarta..."
                    className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-500"
                  />
                  <Icon className="absolute left-2.5 top-2.5 text-[16px] text-slate-400 pointer-events-none">search</Icon>
                </div>
              </div>

              {/* Search Results */}
              {isSearching && (
                <p className="text-xs text-slate-400 text-center py-2">Searching locations...</p>
              )}

              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {searchResults.map((res) => (
                    <button
                      key={`${res.id || res.latitude}-${res.longitude}`}
                      type="button"
                      onClick={() => {
                        const name = [res.name, res.admin1, res.country].filter(Boolean).slice(0, 2).join(', ')
                        weather.setCustomLocation?.(name, res.latitude, res.longitude)
                        setShowLocationModal(false)
                      }}
                      className="w-full text-left p-2.5 hover:bg-slate-50 transition flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-900 truncate">{res.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{[res.admin1, res.country].filter(Boolean).join(', ')}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {res.latitude.toFixed(2)}, {res.longitude.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty Search Prompt */}
              {!isSearching && searchResults.length === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-1">
                  Type your city, district, or street above to search and select live coordinates.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
