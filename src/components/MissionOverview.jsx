import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import useCamera from '../hooks/useCamera'
import useObjectDetection from '../hooks/useObjectDetection'
import useWeather, { degreesToCardinal } from '../hooks/useWeather'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

export default function MissionOverview({ onNavigate, telemetry }) {
  const weather = useWeather(telemetry.latitude, telemetry.longitude)
  const { videoRef, cameraStatus, toggleCamera } = useCamera()
  const [aiActive, setAiActive] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(1929) // 00:32:09 default start

  const { detections } = useObjectDetection(videoRef, aiActive && cameraStatus === 'connected')
  const videoPanelRef = useRef(null)
  const videoFrameRef = useRef(null)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const markerRef = useRef(null)
  const pathRef = useRef(null)
  const [overlayVersion, setOverlayVersion] = useState(0)
  const [activeNav, setActiveNav] = useState('home')

  // Timer simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTimer = (seconds) => {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }

  // Format flight time (mm:ss)
  const flightTimeFormatted = () => {
    const mins = Math.floor((recordingSeconds % 3600) / 60).toString().padStart(2, '0')
    const secs = (recordingSeconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
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
    const renderedWidth = sourceWidth * ratio
    const renderedHeight = sourceHeight * ratio
    const offsetX = (rect.width - renderedWidth) / 2
    const offsetY = (rect.height - renderedHeight) / 2
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

    const initialPos = [telemetry.latitude || -6.2, telemetry.longitude || 106.816666]
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    }).setView(initialPos, 14)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    // Initial breadcrumb trail
    trailRef.current = [initialPos]
    pathRef.current = L.polyline(trailRef.current, {
      color: '#0f172a',
      weight: 2.5,
      dashArray: '4, 6',
      opacity: 0.8,
    }).addTo(map)

    // Custom marker icon with radar ping
    const customIcon = L.divIcon({
      className: 'custom-drone-marker',
      html: `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background: rgba(16, 185, 129, 0.25); animation: ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width: 14px; height: 14px; border-radius: 50%; background: #0f172a; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
            <div style="width: 4px; height: 4px; border-radius: 50%; background: #10b981;"></div>
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })

    markerRef.current = L.marker(initialPos, { icon: customIcon }).addTo(map)
    leafletRef.current = map

    // Fix tile rendering on mount
    setTimeout(() => map.invalidateSize(), 50)
    setTimeout(() => map.invalidateSize(), 200)
    setTimeout(() => map.invalidateSize(), 600)

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
    }
  }, [])

  // Update map marker and smooth pan to follow drone location
  useEffect(() => {
    if (!leafletRef.current || !markerRef.current) return
    const pos = [telemetry.latitude, telemetry.longitude]
    markerRef.current.setLatLng(pos)
    leafletRef.current.panTo(pos, { animate: true })

    trailRef.current.push(pos)
    if (trailRef.current.length > 30) trailRef.current.shift()
    if (pathRef.current) {
      pathRef.current.setLatLngs(trailRef.current)
    }
  }, [telemetry.latitude, telemetry.longitude])



  return (
    <main className="ml-[72px] flex-1 flex flex-col h-screen overflow-hidden bg-[#f5f7fa] text-[#0f172a]">
      {/* Top Header Bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#eef2f6] bg-white px-6">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Mission Overview</h2>
      </header>

      {/* Main Bento Grid Canvas */}
      <div className="flex-1 min-h-0 overflow-hidden p-3.5 md:p-4 lg:p-5">
          <div className="dashboard-grid-container mx-auto max-w-[1700px] gap-3 lg:gap-3.5">
            
            {/* TOP ROW: Dominant & Tall (Camera Col 9 + Weather Col 3) */}
            <div className="grid grid-cols-12 gap-3 lg:gap-3.5 h-full min-h-0">
            
            {/* TOP-LEFT: Main Drone Camera Viewfinder Feed (col-span-12 lg:col-span-9) */}
            <div className="col-span-12 lg:col-span-9 h-full min-h-0 flex flex-col">
              <div
                ref={videoPanelRef}
                className={`group relative flex flex-1 h-full min-h-0 flex-col overflow-hidden rounded-2xl ${
                  cameraStatus === 'connected' ? 'bg-slate-950' : 'bg-slate-100/90'
                } shadow-sm border border-slate-200/80 [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none`}
              >
                {/* Video Frame Container */}
                <div ref={videoFrameRef} className="relative flex-1 overflow-hidden w-full h-full">
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

                  {/* Clean Light-Slate Camera Standby View (No black background, no shooter crosshairs) */}
                  {cameraStatus !== 'connected' && (
                    <div className="relative flex h-full w-full items-center justify-center bg-[#f8fafc] border border-slate-200/80 rounded-2xl overflow-hidden">
                      {/* Subtle 4-Corner Viewfinder Framing Brackets */}
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

                      {/* Top Viewport Header */}
                      <div className="absolute top-4 inset-x-6 flex items-center justify-between text-[11px] font-semibold text-slate-500 data-font pointer-events-none">
                        <span className="text-slate-700 tracking-wider font-bold">DRONE CAMERA FEED</span>
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          OPTICAL SENSOR STANDBY
                        </span>
                      </div>

                      {/* Prominent Center Action Button */}
                      <div className="relative z-10 flex flex-col items-center">
                        <button
                          onClick={toggleCamera}
                          className="flex items-center gap-2.5 rounded-xl bg-slate-900 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-slate-800 active:scale-95 transition"
                        >
                          <Icon className="text-[20px] text-white">videocam</Icon>
                          <span>Start Live Camera</span>
                        </button>
                      </div>

                      {/* Bottom Viewport Info */}
                      <div className="absolute bottom-4 inset-x-6 flex items-center justify-between text-[11px] font-semibold text-slate-400 data-font pointer-events-none">
                        <span>1080P 60FPS HD</span>
                        <span>16:9 VIEWPORT</span>
                      </div>
                    </div>
                  )}

                  {/* Top-Right Pill (Active only when camera connected) */}
                  {cameraStatus === 'connected' && (
                    <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-xl bg-black/50 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white shadow-md border border-white/10">
                        <span className="data-font tracking-wider font-bold">REC {formatTimer(recordingSeconds)}</span>
                      </div>
                    </div>
                  )}

                  {/* Bottom Quick Control Bar (Active only when camera connected) */}
                  {cameraStatus === 'connected' && (
                    <div className="absolute bottom-3 inset-x-3 z-30 flex items-center justify-between rounded-xl bg-black/50 backdrop-blur-md px-3.5 py-2 text-white border border-white/10 shadow-lg">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleCamera}
                          className="flex items-center gap-1.5 rounded-lg bg-red-500/90 hover:bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition shadow-sm"
                          title="Stop Live Camera Stream"
                        >
                          <Icon className="text-[16px]">videocam_off</Icon>
                          <span>Stop Camera</span>
                        </button>

                        <button
                          onClick={() => setAiActive((v) => !v)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            aiActive
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                          title="Toggle AI Object Detection"
                        >
                          <Icon className="text-[16px]">psychology</Icon>
                          <span>AI Detect {aiActive ? `(${detections.length})` : 'Off'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-white/80">
                        <span className="hidden sm:inline data-font text-[11px]">LIVE 1080P · COCO-SSD</span>
                        <button
                          onClick={() => {
                            if (document.fullscreenElement) {
                              document.exitFullscreen()
                            } else {
                              videoPanelRef.current?.requestFullscreen()
                            }
                          }}
                          className="rounded-lg p-1.5 hover:bg-white/20 text-white transition"
                          title="Toggle Fullscreen"
                        >
                          <Icon className="text-[18px]">fullscreen</Icon>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TOP-RIGHT: Elegant Weather Card (col-span-12 lg:col-span-3) */}
            <div className="col-span-12 lg:col-span-3 h-full min-h-0 flex flex-col">
              <div className="bento-card flex flex-1 h-full min-h-0 flex-col justify-between p-3.5 sm:p-4 gap-2 rounded-2xl">
                
                {/* Header Titles */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 shrink-0">
                  <span className="text-xs font-bold text-slate-600 tracking-wider uppercase">
                    TODAY'S WEATHER
                  </span>
                  <span className="text-xs font-bold text-slate-400 data-font">
                    {weather.sector}
                  </span>
                </div>

                {/* HERO: Large Dynamic Weather Graphic + Temperature Display */}
                <div className="flex flex-col items-center justify-center text-center my-auto py-1">
                  {/* Dynamic Weather SVG Graphic */}
                  <div className="relative mb-1 flex items-center justify-center">
                    {weather.weatherType === 'clear' && (
                      <svg className="w-32 h-26 sm:w-36 sm:h-28 drop-shadow-md transition-transform hover:scale-105 duration-300" viewBox="0 0 120 100" fill="none">
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
                    )}

                    {weather.weatherType === 'rain' && (
                      <svg className="w-32 h-26 sm:w-36 sm:h-28 drop-shadow-md transition-transform hover:scale-105 duration-300" viewBox="0 0 120 100" fill="none">
                        <g filter="url(#rainCloudShadow)">
                          <path
                            d="M32 58C24.268 58 18 51.732 18 44C18 36.8412 23.364 31.0068 30.3478 30.1167C32.1465 17.8159 42.6644 8 55.5 8C67.0988 8 76.8837 16.0152 79.5936 26.7513C81.3323 26.2586 83.1818 26 85.0909 26C93.8772 26 101 33.1634 101 42C101 50.8366 93.8772 58 85.0909 58H32Z"
                            fill="url(#rainCloudGrad)"
                          />
                        </g>
                        {/* Raindrops */}
                        <line x1="38" y1="66" x2="32" y2="80" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                        <line x1="56" y1="66" x2="50" y2="80" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                        <line x1="74" y1="66" x2="68" y2="80" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                        <line x1="90" y1="66" x2="84" y2="80" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                        <defs>
                          <linearGradient id="rainCloudGrad" x1="18" y1="8" x2="101" y2="58" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#94a3b8" />
                            <stop offset="0.7" stopColor="#64748b" />
                            <stop offset="1" stopColor="#475569" />
                          </linearGradient>
                          <filter id="rainCloudShadow" x="12" y="6" width="95" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#334155" floodOpacity="0.2" />
                          </filter>
                        </defs>
                      </svg>
                    )}

                    {weather.weatherType === 'thunderstorm' && (
                      <svg className="w-32 h-26 sm:w-36 sm:h-28 drop-shadow-md transition-transform hover:scale-105 duration-300" viewBox="0 0 120 100" fill="none">
                        <path
                          d="M32 54C24.268 54 18 47.732 18 40C18 32.8412 23.364 27.0068 30.3478 26.1167C32.1465 13.8159 42.6644 4 55.5 4C67.0988 4 76.8837 12.0152 79.5936 22.7513C81.3323 22.2586 83.1818 22 85.0909 22C93.8772 22 101 29.1634 101 38C101 46.8366 93.8772 54 85.0909 54H32Z"
                          fill="#334155"
                        />
                        <polygon points="58,52 46,68 56,68 50,84 70,64 60,64 66,52" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
                      </svg>
                    )}

                    {(weather.weatherType !== 'clear' && weather.weatherType !== 'rain' && weather.weatherType !== 'thunderstorm') && (
                      <svg className="w-32 h-26 sm:w-36 sm:h-28 drop-shadow-md transition-transform hover:scale-105 duration-300" viewBox="0 0 120 100" fill="none">
                        <circle cx="78" cy="40" r="22" fill="url(#sunGradient)" />
                        <circle cx="78" cy="40" r="26" stroke="#fbbf24" strokeWidth="2" strokeDasharray="3 6" opacity="0.6" />
                        
                        <g filter="url(#cloudShadow)">
                          <path
                            d="M32 72C24.268 72 18 65.732 18 58C18 50.8412 23.364 45.0068 30.3478 44.1167C32.1465 31.8159 42.6644 22 55.5 22C67.0988 22 76.8837 30.0152 79.5936 40.7513C81.3323 40.2586 83.1818 40 85.0909 40C93.8772 40 101 47.1634 101 56C101 64.8366 93.8772 72 85.0909 72H32Z"
                            fill="url(#cloudGradient)"
                          />
                        </g>

                        <defs>
                          <linearGradient id="sunGradient" x1="56" y1="18" x2="100" y2="62" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#fde047" />
                            <stop offset="0.6" stopColor="#f59e0b" />
                            <stop offset="1" stopColor="#ea580c" />
                          </linearGradient>
                          <linearGradient id="cloudGradient" x1="18" y1="22" x2="101" y2="72" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#ffffff" />
                            <stop offset="0.7" stopColor="#f0f9ff" />
                            <stop offset="1" stopColor="#bae6fd" />
                          </linearGradient>
                          <filter id="cloudShadow" x="12" y="18" width="95" height="60" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#0284c7" floodOpacity="0.15" />
                          </filter>
                        </defs>
                      </svg>
                    )}
                  </div>

                  {/* Temperature and Condition */}
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="data-font text-5xl sm:text-6xl font-black text-slate-900 tracking-tight leading-none">
                      {weather.temperature}
                    </span>
                    <span className="text-2xl font-bold text-slate-400">°C</span>
                  </div>
                  <p className="mt-1 text-sm sm:text-base font-extrabold text-slate-800">{weather.condition}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Precipitation {weather.precipitation}% · Humidity {weather.humidity}%
                  </p>
                </div>

                {/* BOTTOM SECTION: Wind Speed & Drone Location */}
                <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 shrink-0">
                  
                  {/* Row 1: Wind Speed */}
                  <div className="bento-subcard p-2 sm:p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Icon className="text-[18px] text-slate-500 shrink-0">air</Icon>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                          WIND SPEED
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="data-font text-xs sm:text-sm font-bold text-slate-900">{weather.windSpeed} m/s</span>
                          <span className="text-[10px] text-slate-400 font-medium">({weather.windSpeedKmH} km/h)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 data-font">
                      <Icon className="text-[14px] text-slate-500">near_me</Icon>
                      <span>{weather.windDirection}° {weather.windCardinal}</span>
                    </div>
                  </div>

                  {/* Row 2: Drone Location */}
                  <div className="bento-subcard p-2 sm:p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="text-[18px] text-slate-500 shrink-0">location_on</Icon>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none">
                          DRONE LOCATION
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5" title={weather.locationName}>
                          {weather.locationName}
                        </p>
                        <p className="data-font text-[10px] text-slate-400 truncate" title={weather.dmsLocation}>
                          {weather.dmsLocation}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 text-[11px] font-bold text-slate-500 data-font">
                      {weather.satellites} Sats
                    </span>
                  </div>

                </div>

              </div>
            </div>

          </div>

          {/* BOTTOM ROW: Compact & Clean (Map Col 3 + Telemetry Col 6 + Compass Col 3) */}
          <div className="grid grid-cols-12 gap-3 lg:gap-3.5 h-full min-h-0">
            
            {/* BOTTOM-LEFT: Mini Map Card (col-span-12 md:col-span-4 lg:col-span-3) */}
            <div className="col-span-12 md:col-span-4 lg:col-span-3 h-full min-h-0 flex flex-col">
              <div
                onClick={() => onNavigate('map')}
                className="bento-card relative flex flex-1 h-full min-h-0 flex-col overflow-hidden rounded-2xl cursor-pointer group hover:border-slate-300 transition"
                title="Click to open Full Map & Flight Controls"
              >
                {/* Embedded Leaflet Map Container */}
                <div ref={mapRef} className="absolute inset-0 z-0 h-full w-full" />
                
                {/* Top-Right Quick Expand Icon */}
                <div className="absolute top-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm backdrop-blur-md transition group-hover:bg-white group-hover:scale-105 border border-slate-200/80">
                  <Icon className="text-[16px] text-slate-600">open_in_new</Icon>
                </div>

                {/* Floating Bottom Frosted Glass Location Card */}
                <div className="absolute bottom-2.5 inset-x-2.5 z-20 rounded-xl bg-white/95 backdrop-blur-md p-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-slate-200/80 flex items-center justify-between transition group-hover:border-slate-300">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Drone Location</span>
                    <p className="text-xs font-bold text-slate-900 truncate" title={weather.locationName}>
                      {weather.locationName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 data-font">
                    <Icon className="text-[14px] text-slate-400">satellite_alt</Icon>
                    <span>{weather.satellites || 18} sats</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM-CENTER: Flight Dynamics & Telemetry Console (col-span-12 md:col-span-8 lg:col-span-6) */}
            <div className="col-span-12 md:col-span-8 lg:col-span-6 h-full min-h-0 flex flex-col">
              <div className="bento-card flex flex-1 h-full min-h-0 flex-col justify-between p-3.5 sm:p-4 gap-2.5 rounded-2xl">
                
                {/* Top Row: Battery Status & Radio Signal Link */}
                <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100 shrink-0">
                  {/* Battery Widget */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">BATTERY</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-900 data-font">
                        <Icon className="text-[17px] text-emerald-600">battery_5_bar</Icon>
                        <span>{telemetry.battery}%</span>
                      </div>
                      <span className="data-font text-xs font-medium text-slate-400">
                        ({Math.round(4563 * telemetry.battery / 100)} / 4563 mAh)
                      </span>
                    </div>
                  </div>

                  {/* Signal Link Widget */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SIGNAL</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-900 data-font">
                        <Icon className="text-[17px] text-slate-700">signal_cellular_alt</Icon>
                        <span>{telemetry.signal}%</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 data-font">
                        5.8 GHz
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4 Telemetry Metrics Bento Subcards (2x2 Grid) */}
                <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0 items-stretch">
                  
                  {/* Metric 1: Altitude */}
                  <div className="bento-subcard p-2.5 sm:p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        ALTITUDE (AGL)
                      </span>
                      <Icon className="text-[18px] text-slate-400">height</Icon>
                    </div>
                    <div className="flex items-baseline gap-1 my-0.5">
                      <span className="data-font text-2xl sm:text-3xl font-black text-slate-900 leading-none">
                        {telemetry.altitude}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-400">m</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-100/80">
                      <span>Max 150m</span>
                      <span className="text-slate-600 font-medium">Stable Level</span>
                    </div>
                  </div>

                  {/* Metric 2: Ground Speed */}
                  <div className="bento-subcard p-2.5 sm:p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        GROUND SPEED
                      </span>
                      <Icon className="text-[18px] text-slate-400">speed</Icon>
                    </div>
                    <div className="flex items-baseline gap-1 my-0.5">
                      <span className="data-font text-2xl sm:text-3xl font-black text-slate-900 leading-none">
                        {telemetry.speed}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-400">m/s</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-100/80">
                      <span className="data-font font-bold text-slate-700">{(telemetry.speed * 3.6).toFixed(1)} km/h</span>
                      <span className="text-slate-600 font-medium">Cruise</span>
                    </div>
                  </div>

                  {/* Metric 3: GPS Coordinates */}
                  <div className="bento-subcard p-2.5 sm:p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        GPS POSITION
                      </span>
                      <Icon className="text-[18px] text-slate-400">near_me</Icon>
                    </div>
                    <div className="my-0.5">
                      <p className="data-font text-xs sm:text-sm font-black text-slate-900 truncate">
                        {telemetry.latitude.toFixed(5)}, {telemetry.longitude.toFixed(5)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-100/80">
                      <span>{weather.satellites || 18} Satellites</span>
                      <span className="text-slate-600 font-medium">3D Fix (0.8m)</span>
                    </div>
                  </div>

                  {/* Metric 4: Flight Air Time */}
                  <div className="bento-subcard p-2.5 sm:p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        AIR TIME
                      </span>
                      <Icon className="text-[18px] text-slate-400">timer</Icon>
                    </div>
                    <div className="my-0.5">
                      <p className="data-font text-2xl sm:text-3xl font-black text-slate-900 leading-none">
                        {flightTimeFormatted()}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-100/80">
                      <span>Mission Logged</span>
                      <span className="text-slate-600 font-medium">Live Link</span>
                    </div>
                  </div>

                </div>

              </div>
            </div>

            {/* BOTTOM-RIGHT: Drone Heading & 3D Gyro Compass (col-span-12 md:col-span-12 lg:col-span-3) */}
            <div className="col-span-12 md:col-span-12 lg:col-span-3 h-full min-h-0 flex flex-col">
              <div className="bento-card flex flex-1 h-full min-h-0 flex-col items-center justify-between p-3.5 sm:p-4 text-center gap-1 rounded-2xl">
                
                {/* Header: Title + Dynamic Degree Text */}
                <div className="flex items-center justify-between w-full pb-1 border-b border-slate-100 shrink-0">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">
                    HEADING
                  </span>
                  <span className="data-font text-xs font-bold text-slate-700">
                    {telemetry.heading}° {degreesToCardinal(telemetry.heading)}
                  </span>
                </div>

                {/* 360° Rotating Gyro Compass Dial */}
                <div className="relative my-auto flex h-[105px] w-[105px] sm:h-[114px] sm:w-[114px] items-center justify-center">
                  {/* Rotating Dial Ring */}
                  <div
                    className="absolute inset-0 transition-transform duration-700 ease-out"
                    style={{ transform: `rotate(${-telemetry.heading}deg)` }}
                  >
                    <svg className="h-full w-full" viewBox="0 0 140 140">
                      {/* Outer Ring Circle */}
                      <circle cx="70" cy="70" r="64" stroke="#e2e8f0" strokeWidth="1.2" fill="none" />
                      <circle cx="70" cy="70" r="54" stroke="#f1f5f9" strokeWidth="1" fill="none" />

                      {/* Cardinal Directions */}
                      <text x="70" y="24" textAnchor="middle" fill="#ef4444" fontSize="13" fontWeight="900" fontFamily="JetBrains Mono">N</text>
                      <text x="122" y="74" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono">E</text>
                      <text x="70" y="126" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono">S</text>
                      <text x="18" y="74" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono">W</text>

                      {/* Small Compass Radial Ticks */}
                      {Array.from({ length: 24 }).map((_, i) => {
                        const angle = i * 15
                        const rad = (angle * Math.PI) / 180
                        const isMain = angle % 90 === 0
                        const isMid = angle % 45 === 0
                        const r1 = 64
                        const r2 = isMain ? 54 : isMid ? 57 : 60
                        const x1 = 70 + r1 * Math.sin(rad)
                        const y1 = 70 - r1 * Math.cos(rad)
                        const x2 = 70 + r2 * Math.sin(rad)
                        const y2 = 70 - r2 * Math.cos(rad)
                        return (
                          <line
                            key={i}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={isMain ? (angle === 0 ? '#ef4444' : '#475569') : isMid ? '#64748b' : '#cbd5e1'}
                            strokeWidth={isMain ? 2 : isMid ? 1.5 : 1}
                          />
                        )
                      })}
                    </svg>
                  </div>

                  {/* Fixed Center Pointer / Aircraft Needle */}
                  <div className="pointer-events-none z-10 flex items-center justify-center">
                    <svg className="h-9 w-9 text-slate-800 drop-shadow-sm" viewBox="0 0 24 24" fill="none">
                      <polygon points="12,2 18,20 12,16 6,20" fill="#0f172a" stroke="#ffffff" strokeWidth="1.2" />
                    </svg>
                  </div>
                </div>

                {/* Bottom Coordinates & Gyro Status */}
                <div className="w-full pt-1.5 border-t border-slate-100 flex flex-col items-center gap-0.5 shrink-0">
                  <p className="data-font text-[10px] sm:text-[11px] font-bold text-slate-700 truncate w-full" title={weather.dmsLocation}>
                    {weather.dmsLocation}
                  </p>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    GYRO STABILIZED · 3-AXIS
                  </span>
                </div>

              </div>
            </div>

          </div>

        </div>
      </div>
    </main>
  )
}
