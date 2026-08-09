import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import useCamera from '../hooks/useCamera'
import useObjectDetection from '../hooks/useObjectDetection'
import logoUrl from '../assets/logo-eagle.png'
const navItems = [['dashboard', 'Mission Overview'], ['map', 'Map & Search Area'], ['target', 'Detection Events'], ['history', 'Flight History'], ['settings', 'System Settings']]
const Icon = ({ children, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{children}</span>

function MissionOverview({ onNavigate, telemetry }) {
  const { videoRef, cameraStatus, toggleCamera } = useCamera()
  const [aiActive, setAiActive] = useState(false)
  const [time, setTime] = useState(new Date())
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const { detections, modelStatus } = useObjectDetection(videoRef, aiActive && cameraStatus === 'connected')
  const videoPanelRef = useRef(null)
  const videoFrameRef = useRef(null)
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const markerRef = useRef(null)
  const [overlayVersion, setOverlayVersion] = useState(0)

  useEffect(() => {
    const intervalId = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (cameraStatus !== 'connected') {
      setRecordingSeconds(0)
      return undefined
    }
    const intervalId = setInterval(() => setRecordingSeconds((value) => value + 1), 1000)
    return () => clearInterval(intervalId)
  }, [cameraStatus])

  useEffect(() => {
    const onFullscreenChange = () => setIsVideoFullscreen(document.fullscreenElement === videoPanelRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  async function toggleVideoFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await videoPanelRef.current?.requestFullscreen()
  }

  useEffect(() => {
    if (!videoFrameRef.current) return
    const observer = new ResizeObserver(() => setOverlayVersion((value) => value + 1))
    observer.observe(videoFrameRef.current)
    return () => observer.disconnect()
  }, [cameraStatus])

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
    context.font = '700 12px JetBrains Mono, monospace'
    detections.forEach(({ bbox, score }) => {
      const [x, y, width, height] = bbox
      const boxX = x * ratio + offsetX
      const boxY = y * ratio + offsetY
      const boxWidth = width * ratio
      const boxHeight = height * ratio
      context.fillStyle = 'rgba(74, 217, 232, .12)'
      context.fillRect(boxX, boxY, boxWidth, boxHeight)
      context.strokeStyle = '#4ad9e8'
      context.strokeRect(boxX, boxY, boxWidth, boxHeight)
      const label = `PERSON ${Math.round(score * 100)}%`
      const labelWidth = context.measureText(label).width + 16
      context.fillStyle = '#4ad9e8'
      context.fillRect(boxX, Math.max(0, boxY - 23), labelWidth, 23)
      context.fillStyle = '#00363b'
      context.fillText(label, boxX + 8, Math.max(15, boxY - 7))
    })
  }, [cameraStatus, aiActive, detections, overlayVersion, videoRef])

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return
    leafletRef.current = L.map(mapRef.current, { zoomControl: false }).setView([-6.2, 106.816666], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(leafletRef.current)
    markerRef.current = L.marker([-6.2, 106.816666]).addTo(leafletRef.current).bindPopup('Eagle Drone')
    return () => {
      leafletRef.current?.remove()
      leafletRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!leafletRef.current || !markerRef.current) return
    const position = [telemetry.latitude, telemetry.longitude]
    markerRef.current.setLatLng(position)
    leafletRef.current.panTo(position, { animate: true })
  }, [telemetry.latitude, telemetry.longitude])

  const detectionStatus = cameraStatus !== 'connected'
    ? ['Camera offline', 'Start camera to enable detection', 'CAMERA: OFFLINE']
    : !aiActive
      ? ['Detection system standing by', 'Enable AI DETECT to scan camera feed', 'AI: IDLE']
      : modelStatus === 'loading'
        ? ['Detection system standing by', 'Loading COCO-SSD model', 'AI: LOADING']
        : modelStatus === 'error'
          ? ['Detection model unavailable', 'COCO-SSD failed to load', 'AI: ERROR']
          : detections.length
            ? ['Potential human detected in camera feed', 'Live person detection event', `PERSON: ${detections.length}`]
            : ['No human detected', 'Scanning live camera feed', 'PERSON: 0']

  const recordingTime = new Date(recordingSeconds * 1000).toISOString().slice(11, 19)

  const metrics = [
    ['ALTITUDE', `${telemetry.altitude}m`, 'text-secondary-fixed'],
    ['SPEED (GND)', `${telemetry.speed}m/s`, 'text-on-surface'],
    ['HEADING', `${telemetry.heading}°`, 'text-on-surface'],
    ['BATTERY', `${Math.round(telemetry.battery)}%`, 'text-primary'],
    ['SIGNAL', `${telemetry.signal}%`, 'text-on-surface'],
    ['GPS', `${telemetry.latitude.toFixed(3)}\n${telemetry.longitude.toFixed(3)}`, 'text-on-surface'],
  ]

  return <div className="flex h-screen justify-center overflow-hidden bg-[#0b0e14]">
    <div className="relative flex h-full w-full overflow-hidden bg-surface-container-lowest">
      <aside className="z-50 hidden h-full w-64 shrink-0 flex-col border-r border-white/10 bg-surface-container py-5 md:flex">
        <div className="mb-8 flex items-center gap-3 px-6"><img alt="Eagle Drone Logo" className="h-10 w-24 rounded-md object-contain" src={logoUrl} /><div><h1 className="font-headline-md text-2xl font-bold tracking-tight text-primary">Eagle Drone</h1><p className="font-body-sm text-sm text-on-surface-variant">SAR Command Unit</p></div></div>
        <nav className="flex-1 space-y-2 px-4">{navItems.map(([icon, label], index) => <button key={label} onClick={() => index === 1 ? onNavigate('map') : index === 2 ? onNavigate('events') : index === 3 ? onNavigate('history') : index === 4 && onNavigate('settings')} className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition ${index === 0 ? 'border-r-2 border-primary bg-primary/5 font-bold text-primary' : 'font-medium text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'}`}><Icon className={index === 0 ? '[font-variation-settings:"FILL"_1]' : ''}>{icon}</Icon><span className="font-label-caps text-xs tracking-[.08em]">{label}</span></button>)}</nav>
      </aside>
      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-white/5 bg-surface px-4 md:px-6"><div className="flex items-center gap-4"><h2 className="font-headline-sm text-lg font-bold text-on-surface">Mission Overview</h2><div className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-container-high px-3 py-1"><Icon className="text-[16px] text-secondary">emergency</Icon><span className="font-data-md text-sm text-secondary">SAR-2026-041</span><span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-error" /><span className="font-label-caps text-xs text-error">Active</span></div></div><div className="flex items-center gap-3 md:gap-6"><div className="hidden items-center gap-2 font-data-md text-sm text-on-surface-variant md:flex"><Icon className="text-[18px]">schedule</Icon>{time.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })} WIB</div><div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-primary/30 bg-surface-variant"><Icon className="text-on-surface-variant">person</Icon></div></div></header>
        <div className="flex-1 overflow-y-auto p-4 pb-6 md:p-6">
          <div className={`glass-panel mb-4 flex flex-wrap items-center justify-between gap-4 rounded-r-lg border-l-4 p-4 ${detections.length ? 'alert-pulse border-error' : 'border-outline/40'}`}><div className="flex items-start gap-4"><Icon className={`mt-1 text-[28px] ${detections.length ? 'text-error' : 'text-on-surface-variant'}`}>warning</Icon><div><h3 className={`font-headline-sm mb-1 text-lg font-bold ${detections.length ? 'text-error' : 'text-on-surface'}`}>{detectionStatus[0]}</h3><div className="data-font flex gap-4 text-sm text-on-error-container"><span>{detectionStatus[2]}</span><span>AI: {modelStatus.toUpperCase()}</span></div><p className="mt-1 text-sm text-on-surface-variant">{detectionStatus[1]}</p></div></div><button disabled={!detections.length} className={`rounded-md px-6 py-2.5 font-label-caps text-xs transition ${detections.length ? 'bg-error text-on-error hover:bg-error/80' : 'cursor-not-allowed border border-white/10 bg-surface-container text-on-surface-variant'}`}>Review Detection</button></div>
          <div className="grid min-h-[600px] grid-cols-12 gap-4">
            <div className="col-span-12 flex h-full flex-col gap-4 lg:col-span-8">
              <div ref={videoPanelRef} className="group relative flex min-h-[400px] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none"><div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-md border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md"><span className={`h-2.5 w-2.5 rounded-full ${cameraStatus === 'connected' ? 'animate-pulse bg-error' : 'bg-outline'}`} /><span className="data-font text-sm text-white">{cameraStatus === 'connected' ? 'REC' : cameraStatus.toUpperCase()}</span><span className="mx-1 text-white/50">|</span><span className="data-font text-sm text-white">{recordingTime}</span></div><div ref={videoFrameRef} className="relative flex-1 overflow-hidden bg-surface-container-high"><video ref={videoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${cameraStatus === 'connected' ? '' : 'hidden'}`} />{cameraStatus === 'connected' && <canvas className="pointer-events-none absolute inset-0 z-10" />}{cameraStatus !== 'connected' && <div className="absolute inset-0 grid place-items-center bg-surface-container-high"><div className="text-center"><Icon className="mb-3 text-5xl text-outline">videocam_off</Icon><p className="font-data-md text-sm text-on-surface-variant">NO SIGNAL</p><p className="mt-1 font-label-caps text-[10px] text-outline">START CAMERA TO CONNECT</p></div></div>}</div><div className="absolute bottom-0 flex w-full items-center justify-between border-t border-white/10 bg-surface-container/90 p-3 backdrop-blur-md"><div className="flex gap-2"><button onClick={toggleCamera} className="rounded-md border border-white/5 bg-surface-variant p-2 text-on-surface hover:bg-surface-bright"><Icon>videocam</Icon></button><button onClick={() => setAiActive((value) => !value)} className={`flex items-center gap-2 rounded-md border px-4 py-2 ${aiActive ? 'border-secondary/30 bg-secondary/20 text-secondary' : 'border-white/10 bg-surface-variant text-on-surface-variant'}`}><Icon className="text-[20px]">psychology</Icon><span className="font-label-caps text-[10px]">AI DETECT</span></button><button onClick={toggleVideoFullscreen} className="rounded-md border border-white/5 bg-surface-variant p-2 text-on-surface hover:bg-surface-bright"><Icon>{isVideoFullscreen ? 'fullscreen_exit' : 'fullscreen'}</Icon></button></div><span className="data-font text-xs text-on-surface-variant">CAMERA: {cameraStatus.toUpperCase()} · PEOPLE: {detections.length}</span></div></div>
              <div className="grid grid-cols-4 gap-3 md:grid-cols-6">{metrics.map(([label, value, color], index) => <div key={label} className={`glass-panel flex min-h-[80px] flex-col items-center justify-center rounded-2xl p-3 ${index === 3 ? 'border-t-2 border-primary' : ''} ${index > 4 ? 'col-span-2 md:col-span-1' : ''}`}><span className="mb-1 font-label-caps text-[10px] text-on-surface-variant">{label}</span><span className={`data-font whitespace-pre-line text-center text-lg ${color}`}>{value}</span></div>)}</div>
            </div>
            <div className="col-span-12 flex h-full flex-col gap-4 lg:col-span-4"><div className="glass-panel relative h-64 shrink-0 overflow-hidden rounded-2xl"><div ref={mapRef} className="h-full w-full" /><div className="absolute left-2 top-2 rounded border border-white/5 bg-surface/80 px-2 py-1 font-label-caps text-[10px] text-on-surface-variant backdrop-blur">OPENSTREETMAP DATA</div></div><div className="glass-panel flex flex-1 flex-col overflow-hidden rounded-2xl"><div className="border-b border-white/10 bg-surface-container/50 p-4"><h4 className="font-headline-sm mb-2 text-lg text-on-surface">AI Detection Subsystem</h4><div className="flex items-center justify-between rounded-md border border-white/5 bg-surface-container-highest p-2"><div className="flex items-center gap-2"><Icon className="text-[18px] text-secondary">model_training</Icon><span className="data-font text-xs text-on-surface-variant">COCO-SSD [{modelStatus.toUpperCase()}]</span></div><span className="data-font text-xs text-secondary">PERSON: {detections.length}</span></div></div><div className="flex-1 space-y-3 overflow-y-auto p-3">{detections.length ? detections.map((item, index) => <Detection key={index} status={`PERSON (${Math.round(item.score * 100)}%)`} age="live" label="Camera feed detection" variant="error" />) : <Detection status="NO PERSON" age="live" label="No human detected" variant="primary" faded />}</div></div><div className="glass-panel rounded-2xl bg-surface-container/30 p-4"><h4 className="mb-3 border-b border-white/10 pb-2 font-label-caps text-xs text-on-surface-variant">INCIDENT SUMMARY</h4><div className="space-y-2 text-xs">{[['Type', 'Missing Person'], ['Active Sector', 'C-4'], ['Duration', '01:42:15'], ['Weather', 'Clear / Wind 5kn']].map(([label, value]) => <div className="flex items-center justify-between" key={label}><span className="text-on-surface-variant">{label}</span><span className={`data-font text-[13px] text-on-surface ${label === 'Duration' ? 'text-primary' : ''}`}>{value}</span></div>)}</div></div></div>
          </div>
        </div><footer className="z-40 flex h-8 shrink-0 items-center justify-between border-t border-white/5 bg-surface-container-lowest px-4"><div className="flex gap-3 md:gap-6">{[['bg-secondary-fixed', 'Receiver: OK'], ['bg-secondary-fixed', 'Telemetry: LNK'], ['bg-primary', 'AI: RDY']].map(([color, label]) => <span className="data-font flex items-center gap-1 text-[11px] text-outline" key={label}><span className={`h-1.5 w-1.5 rounded-full ${color}`} />{label}</span>)}</div><span className="font-label-caps text-[10px] text-on-surface-variant opacity-50">v4.2.0-PRO</span></footer>
      </main>
    </div>
  </div>
}

function Detection({ status, age, label, variant, faded = false }) { const color = variant === 'error' ? 'text-error' : 'text-primary'; return <div className={`flex gap-3 rounded-lg border border-white/5 bg-surface-container-high p-2 ${faded ? 'opacity-60' : ''}`}><div className="grid h-12 w-16 place-items-center rounded border border-white/10 bg-surface-variant"><Icon className="text-[20px] text-on-surface-variant">person</Icon></div><div className="flex-1"><div className="flex items-start justify-between"><span className={`font-label-caps text-[10px] ${color}`}>{status}</span><span className="data-font text-[10px] text-on-surface-variant">{age}</span></div><p className="mt-1 text-xs text-on-surface">{label}</p></div></div> }
export default MissionOverview
