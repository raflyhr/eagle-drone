import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

const defaultTrack = [
  [-7.595, 110.4485],
  [-7.5938, 110.451],
  [-7.5915, 110.4532],
  [-7.5894, 110.4516],
  [-7.5878, 110.4488],
  [-7.5902, 110.4462],
  [-7.5931, 110.4468],
]

export default function FlightDetail({ mission, onBack, mapStyle = 'standard', onMapStyleChange }) {
  const mapContainerRef = useRef(null)
  const mapPanelRef = useRef(null)
  const mapRef = useRef(null)
  const baseLayerRef = useRef(null)
  const overlayLayerRef = useRef(null)
  const [selectedCapture, setSelectedCapture] = useState(null)
  const [panelVisible, setPanelVisible] = useState(true)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [capturePage, setCapturePage] = useState(0)

  // Real recorded captures and marked locations from mission telemetry log
  const captures = useMemo(() => mission?.captures || [], [mission?.captures])
  const markedLocations = useMemo(() => mission?.markedLocations || [], [mission?.markedLocations])
  const trackPoints = useMemo(() => mission?.trackPoints?.length ? mission.trackPoints : defaultTrack, [mission?.trackPoints])
  const startPoint = trackPoints[0]
  const finishPoint = trackPoints.at(-1)
  const capturesPerPage = panelVisible ? 4 : 5
  const capturePageCount = Math.ceil(captures.length / capturesPerPage) || 1
  const visibleCaptures = captures.slice(capturePage * capturesPerPage, (capturePage + 1) * capturesPerPage)

  useEffect(() => {
    setCapturePage(0)
  }, [panelVisible])

  useEffect(() => {
    if (capturePage >= capturePageCount) setCapturePage(Math.max(0, capturePageCount - 1))
  }, [capturePage, capturePageCount])

  const updateTileLayer = (map, style) => {
    if (!map) return
    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current)
      baseLayerRef.current = null
    }
    if (overlayLayerRef.current) {
      map.removeLayer(overlayLayerRef.current)
      overlayLayerRef.current = null
    }

    if (style === 'satellite') {
      baseLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; Esri Satellite', maxZoom: 19 }).addTo(map)
      overlayLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.85 }).addTo(map)
    } else if (style === 'terrain') {
      baseLayerRef.current = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenTopoMap', maxZoom: 17 }).addTo(map)
    } else {
      baseLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map)
    }
  }

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, { zoomControl: false })
    updateTileLayer(map, mapStyle)

    const path = L.polyline(trackPoints, { color: '#0284c7', weight: 4, opacity: 0.9 }).addTo(map)
    L.circleMarker(startPoint, { radius: 7, color: '#ffffff', weight: 3, fillColor: '#16a34a', fillOpacity: 1 }).bindTooltip('Start').addTo(map)
    L.circleMarker(finishPoint, { radius: 7, color: '#ffffff', weight: 3, fillColor: '#dc2626', fillOpacity: 1 }).bindTooltip('Finish').addTo(map)
    markedLocations.forEach((location, index) => {
      L.marker(location.coordinate, {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:30px;height:30px;border-radius:9px;background:#dc2626;border:3px solid white;box-shadow:0 4px 12px #0f172a33;color:white;display:grid;place-items:center"><span class="material-symbols-outlined" style="font-size:17px">person_pin_circle</span></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).bindTooltip(`${location.id || `MK-${String(index + 1).padStart(2, '0')}`} · ${location.altitude || 0} m`).addTo(map)
    })
    map.fitBounds(path.getBounds(), { padding: [35, 35] })
    mapRef.current = map

    const timer = setTimeout(() => map.invalidateSize(), 0)
    return () => {
      clearTimeout(timer)
      map.remove()
      mapRef.current = null
    }
  }, [finishPoint, markedLocations, startPoint, trackPoints])

  useEffect(() => {
    if (mapRef.current) {
      updateTileLayer(mapRef.current, mapStyle)
    }
  }, [mapStyle])

  useEffect(() => {
    setTimeout(() => mapRef.current?.invalidateSize(), 120)
  }, [panelVisible])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMapFullscreen(document.fullscreenElement === mapPanelRef.current)
      setTimeout(() => mapRef.current?.invalidateSize(), 120)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const focusPerson = (person) => {
    mapRef.current?.flyTo(person.coordinate, 17, { duration: 0.8 })
  }

  return (
    <main className="ml-[72px] flex h-screen min-w-0 flex-1 flex-col bg-[#f5f7fa] text-slate-900">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Back to Flight History">
            <Icon className="text-[20px]">arrow_back</Icon>
          </button>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Flight Detail</h2>
            <p className="text-[11px] font-semibold text-slate-400">{mission?.id || 'LIVE-MAVLINK'} · {mission?.type || 'SAR Mission'}</p>
          </div>
        </div>
        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{mission?.status || 'Success'}</span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4 p-4">
        <section className={`${panelVisible ? 'col-span-9' : 'col-span-12'} grid min-h-0 grid-rows-[70%_30%] gap-4`}>
          <div ref={mapPanelRef} className="bento-card relative min-h-0 overflow-hidden bg-white [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none">
            <div ref={mapContainerRef} className="absolute inset-0" />
            <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recorded Flight Path</p>
              <p className="mt-0.5 text-xs font-bold text-slate-800">{mission?.distance || '0.0 km'} · {mission?.duration || '00:00:00'}</p>
            </div>
            <div className="absolute left-3 top-16 z-[500] flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
              <button onClick={() => mapRef.current?.zoomIn()} className="grid h-8 w-8 place-items-center border-b border-slate-200 text-slate-700 hover:bg-slate-100" title="Zoom in"><Icon className="text-[18px]">add</Icon></button>
              <button onClick={() => mapRef.current?.zoomOut()} className="grid h-8 w-8 place-items-center text-slate-700 hover:bg-slate-100" title="Zoom out"><Icon className="text-[18px]">remove</Icon></button>
            </div>
            <div className="absolute right-3 top-3 z-[500] flex gap-2">
              <div className="flex items-center rounded-md border border-slate-200 bg-white p-0.5 shadow-md">
                {['standard', 'satellite', 'terrain'].map((style) => (
                  <button key={style} onClick={() => onMapStyleChange?.(style)} className={`rounded px-2.5 py-1 text-xs font-semibold transition ${mapStyle === style ? 'bg-slate-900 text-white font-bold' : 'text-slate-700 hover:bg-slate-100'}`}>
                    {style[0].toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
              {!panelVisible && (
                <button onClick={() => setPanelVisible(true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">
                  <Icon className="mr-1 align-middle text-[16px]">right_panel_open</Icon>
                  Show Panel
                </button>
              )}
              <button onClick={() => {
                if (!mapPanelRef.current) return
                if (document.fullscreenElement) document.exitFullscreen()
                else mapPanelRef.current.requestFullscreen().catch(() => {})
              }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">
                <Icon className="mr-1 align-middle text-[16px]">{isMapFullscreen ? 'fullscreen_exit' : 'fullscreen'}</Icon>
                {isMapFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
              </button>
            </div>
          </div>

          <div className="bento-card flex min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2">
              <div>
                <h3 className="text-xs font-bold">Flight Captures</h3>
              </div>
              <span className="text-[11px] font-bold text-slate-500">{captures.length} photos</span>
            </div>

            {captures.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <Icon className="text-[28px] text-slate-300 mb-1">photo_camera_back</Icon>
                <p className="text-xs font-semibold text-slate-500">No photos captured during this flight mission.</p>
              </div>
            ) : (
              <div className={`grid min-h-0 flex-1 gap-3 p-2.5 ${panelVisible ? 'grid-cols-4' : 'grid-cols-5'}`}>
                {visibleCaptures.map((capture) => (
                  <article key={capture.id} onClick={() => setSelectedCapture(capture)} className="min-w-0 min-h-0 cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-300 hover:shadow-md flex flex-col">
                    <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-slate-900">
                      <img src={capture.image || capture.src} alt={capture.label || 'Drone capture'} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-1.5 px-2.5 flex items-center justify-end bg-slate-50 border-t border-slate-100 shrink-0">
                      <span className="text-[11px] font-bold text-sky-700 font-mono">{capture.timestamp || capture.time}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {capturePageCount > 1 && captures.length > 0 && (
              <div className="flex shrink-0 items-center justify-center gap-3 border-t border-slate-100 px-4 py-2">
                <button disabled={capturePage === 0} onClick={() => setCapturePage((page) => page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="text-xs font-semibold text-slate-500">Page {capturePage + 1} of {capturePageCount}</span>
                <button disabled={capturePage >= capturePageCount - 1} onClick={() => setCapturePage((page) => page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            )}
          </div>
        </section>

        {panelVisible && <aside className="bento-card col-span-3 flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h3 className="text-sm font-bold">Mission Information</h3>
            <button onClick={() => setPanelVisible(false)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50" title="Hide information panel">
              <Icon className="mr-1 align-middle text-[16px]">right_panel_close</Icon>
              Hide Panel
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto p-4">
            <section className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coordinates</p>
              <Info label="Start" value={startPoint.map((value) => value.toFixed(5)).join(', ')} />
              <Info label="Finish" value={finishPoint.map((value) => value.toFixed(5)).join(', ')} />
            </section>
            <section className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Flight Time</p>
              <Info label="Date" value={mission?.date || '-'} />
              <Info label="Duration" value={mission?.duration || '-'} />
              <Info label="Max Altitude" value={mission?.maxAltitude || '-'} />
            </section>
            <section className="space-y-2 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Marked Locations</p>
                <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">{markedLocations.length} points</span>
              </div>
              {markedLocations.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 italic py-1">No location markers dropped.</p>
              ) : (
                markedLocations.map((location, index) => {
                  const capture = captures.find((item) => item.id === location.captureId)
                  return (
                    <button key={location.id} onClick={() => focusPerson(location)} className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-sky-300 hover:bg-sky-50/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{location.id || `MK-${String(index + 1).padStart(2, '0')}`}</span>
                        <span className="text-[10px] font-bold text-slate-400">{location.altitude || 0} m</span>
                      </div>
                      <p className="mt-1.5 font-mono text-[10px] text-slate-500">{location.coordinate ? location.coordinate.join(', ') : '-'}</p>
                      <p className="mt-2 text-[10px] font-semibold text-sky-600">{capture ? `Photo ${capture.timestamp}` : 'No linked photo'}</p>
                    </button>
                  )
                })
              )}
            </section>
          </div>
        </aside>}
      </div>
      {selectedCapture && (
        <div onClick={() => setSelectedCapture(null)} className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/80 p-6 backdrop-blur-sm">
          <div onClick={(event) => event.stopPropagation()} className="relative max-h-full w-full max-w-5xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl">
            <button onClick={() => setSelectedCapture(null)} className="absolute right-6 top-6 z-10 grid h-9 w-9 place-items-center rounded-full bg-slate-950/80 text-white hover:bg-slate-950" title="Close photo">
              <Icon>close</Icon>
            </button>
            <img src={selectedCapture.image || selectedCapture.src} alt={selectedCapture.label || 'Drone capture'} className="max-h-[72vh] w-full rounded-xl object-contain bg-slate-950" />
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-4">
              <div>
                <p className="font-mono text-xs font-bold text-slate-700">{selectedCapture.timestamp || selectedCapture.time}</p>
              </div>
              {selectedCapture.detections?.length > 0 && <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">AI: {selectedCapture.detections.map((item) => `${item.label} ${item.confidence}%`).join(', ')}</span>}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <span className="text-right font-mono text-[10px] font-bold text-slate-800">{value}</span>
    </div>
  )
}
