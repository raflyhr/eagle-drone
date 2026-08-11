import { useCallback, useEffect, useRef, useState } from 'react'
import { encodeMavlink2Frame, MAVMSG, MavlinkParser } from '../utils/mavlink'
import { getOfflineLocationName } from '../utils/geoCoder'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { createMissionRecord, deleteTargetPoint, fetchMissionLogs, finalizeMissionOnUnload, formatMissionRecord, getTrackWritePolicy, insertMarkedLocation, insertTargetPoint, insertTrackPoint, updateMissionRecord, uploadMissionCapture } from '../services/missionService'

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0
  const dLat = (lat2 - lat1) * 111000
  const dLon = (lon2 - lon1) * 111000 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180))
  return Math.round(Math.sqrt(dLat * dLat + dLon * dLon))
}

export function formatDistance(meters) {
  if (meters === undefined || meters === null || isNaN(meters)) return '0 m'
  if (meters < 1000) return `${meters} m`
  return `${(meters / 1000).toFixed(2)} km`
}

export function getDroneLocationName(lat, lon) {
  if (!lat || !lon) return 'UAV Takeoff Point'
  return getOfflineLocationName(lat, lon)
}

export default function useTelemetry() {
  const [telemetry, setTelemetry] = useState({
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
    lastHeartbeat: Date.now(),
  })

  const [connectionStatus, setConnectionStatus] = useState('disconnected') // 'disconnected' | 'connecting' | 'connected' | 'error'
  const [connectionType, setConnectionType] = useState('none') // 'none' | 'serial' | 'websocket' | 'simulation'
  const [errorMessage, setErrorMessage] = useState('')
  const [missionLogs, setMissionLogs] = useState([])
  const [currentMission, setCurrentMission] = useState(null)

  const serialPortRef = useRef(null)
  const readerRef = useRef(null)
  const socketRef = useRef(null)
  const parserRef = useRef(null)
  const simTimerRef = useRef(null)
  const seqRef = useRef(0)
  const missionStartRef = useRef(null)
  const missionDistanceRef = useRef(0)
  const missionMaxAltitudeRef = useRef(0)
  const missionPositionRef = useRef(null)
  const missionTrackRef = useRef([])
  const capturesRef = useRef([])
  const pendingCapturesRef = useRef([])
  const markedLocationsRef = useRef([])
  const targetPointsRef = useRef([])
  const latestTelemetryRef = useRef(telemetry)
  const missionDbIdRef = useRef(null)
  const lastTrackWriteRef = useRef({ at: 0, point: null })
  const lastMissionSummaryWriteRef = useRef(0)
  const simStateRef = useRef({
    lat: -7.5950,
    lon: 110.4485,
    heading: 45,
    speed: 18,
    phase: 0,
    radius: 0.012,
    centerLat: -7.5950,
    centerLon: 110.4485,
  })

  const persistCapture = useCallback((missionId, capture) => {
    uploadMissionCapture(missionId, capture)
      .then((stored) => {
        if (!stored) return
        capturesRef.current = capturesRef.current.map((item) => item.id === capture.id ? { ...item, databaseId: stored.id } : item)
        setCurrentMission((mission) => mission ? { ...mission, captures: capturesRef.current } : mission)
      })
      .catch((error) => console.warn('Capture persistence unavailable:', error.message))
  }, [])

  const persistTargetPoint = useCallback((missionId, point) => {
    insertTargetPoint(missionId, point).then((stored) => {
      if (!stored) return
      targetPointsRef.current = targetPointsRef.current.map((item) => item.id === point.id ? { ...item, databaseId: stored.id } : item)
      setCurrentMission((mission) => mission ? { ...mission, targetPoints: targetPointsRef.current } : mission)
    }).catch((error) => console.warn('Target point persistence unavailable:', error.message))
  }, [])

  const updateCurrentMission = useCallback((next) => {
    if (!missionStartRef.current) {
      missionStartRef.current = Date.now()
      missionMaxAltitudeRef.current = next.altitude || 0
      missionPositionRef.current = { lat: next.latitude, lon: next.longitude }
      missionTrackRef.current = Number.isFinite(next.latitude) && Number.isFinite(next.longitude) ? [[next.latitude, next.longitude]] : []
      const missionCode = `${connectionType === 'simulation' ? 'SIM' : 'SAR'}-${Date.now().toString().slice(-8)}`
      createMissionRecord({
        missionCode,
        missionType: next.flightMode === 'AUTO' ? 'evacuation' : 'thermal_search',
        status: 'live',
        startedAt: new Date(missionStartRef.current).toISOString(),
      }).then((id) => {
        missionDbIdRef.current = id
        pendingCapturesRef.current.splice(0).forEach((capture) => persistCapture(id, capture))
        targetPointsRef.current.filter((point) => !point.databaseId).forEach((point) => persistTargetPoint(id, point))
      }).catch((error) => console.warn('Mission persistence unavailable:', error.message))
    }

    const last = missionPositionRef.current
    if (last && next.latitude !== undefined && next.longitude !== undefined) {
      const meters = calculateDistanceMeters(last.lat, last.lon, next.latitude, next.longitude)
      if (meters > 0 && meters < 1000) missionDistanceRef.current += meters
      if (meters > 0 && meters < 1000) missionTrackRef.current = [...missionTrackRef.current, [next.latitude, next.longitude]].slice(-2000)
      missionPositionRef.current = { lat: next.latitude, lon: next.longitude }
    }

    if (missionDbIdRef.current) {
      const trackPoint = {
        recordedAt: new Date().toISOString(),
        latitude: next.latitude,
        longitude: next.longitude,
        altitudeMeters: next.altitude,
        speedMps: next.speed,
        heading: next.heading,
        batteryPercent: next.battery,
      }
      if (getTrackWritePolicy(lastTrackWriteRef.current.at, lastTrackWriteRef.current.point, trackPoint)) {
        lastTrackWriteRef.current = { at: Date.now(), point: trackPoint }
        insertTrackPoint(missionDbIdRef.current, trackPoint).catch((error) => console.warn('Track persistence unavailable:', error.message))
      }
    }

    missionMaxAltitudeRef.current = Math.max(missionMaxAltitudeRef.current, next.altitude || 0)
    const elapsed = Date.now() - missionStartRef.current
    const duration = new Date(elapsed).toISOString().slice(11, 19)

    if (missionDbIdRef.current && Date.now() - lastMissionSummaryWriteRef.current >= 1000) {
      lastMissionSummaryWriteRef.current = Date.now()
      updateMissionRecord(missionDbIdRef.current, {
        durationSeconds: Math.round(elapsed / 1000),
        distanceMeters: missionDistanceRef.current,
        maxAltitudeMeters: missionMaxAltitudeRef.current,
        currentAltitudeMeters: next.altitude,
        startLatitude: missionTrackRef.current[0]?.[0],
        startLongitude: missionTrackRef.current[0]?.[1],
        finishLatitude: missionTrackRef.current.at(-1)?.[0],
        finishLongitude: missionTrackRef.current.at(-1)?.[1],
      }).catch((error) => console.warn('Mission summary persistence unavailable:', error.message))
    }

    setCurrentMission({
      id: 'MISSION',
      type: next.flightMode === 'AUTO' ? 'Evacuation' : 'Thermal Search',
      date: new Date(missionStartRef.current).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      duration,
      distance: formatDistance(missionDistanceRef.current),
      maxAltitude: `${missionMaxAltitudeRef.current} m`,
      status: 'Live',
      captures: capturesRef.current,
       markedLocations: markedLocationsRef.current,
       targetPoints: targetPointsRef.current,
      trackPoints: missionTrackRef.current,
    })
  }, [connectionType, persistCapture, persistTargetPoint])

  // Message Handler Callback for Parser
  const handleMavlinkMessage = useCallback((msg) => {
    setTelemetry((prev) => {
      const next = { ...prev, packetCount: prev.packetCount + 1 }

      if (msg.sysId) next.sysId = msg.sysId
      if (msg.compId) next.compId = msg.compId

      if (msg.msgName === 'HEARTBEAT') {
        next.flightMode = msg.flightMode || prev.flightMode
        next.lastHeartbeat = msg.timestamp
      } else if (msg.msgName === 'SYS_STATUS') {
        if (msg.batteryRemaining !== undefined) next.battery = msg.batteryRemaining
        if (msg.voltageBattery !== undefined) next.voltage = msg.voltageBattery
        if (msg.currentBattery !== undefined) next.current = msg.currentBattery
      } else if (msg.msgName === 'GPS_RAW_INT') {
        if (msg.lat) next.latitude = Number(msg.lat.toFixed(6))
        if (msg.lon) next.longitude = Number(msg.lon.toFixed(6))
        if (msg.alt !== undefined) next.altitude = Math.round(msg.alt)
        if (msg.satellitesVisible !== undefined) next.satellites = msg.satellitesVisible
        if (msg.fixLabel) next.gpsFix = msg.fixLabel
      } else if (msg.msgName === 'ATTITUDE') {
        if (msg.pitch !== undefined) next.pitch = msg.pitch
        if (msg.roll !== undefined) next.roll = msg.roll
        if (msg.yaw !== undefined) {
          next.yaw = msg.yaw
          next.heading = Math.round(msg.yaw)
        }
      } else if (msg.msgName === 'GLOBAL_POSITION_INT' || msg.msgName === 'VFR_HUD') {
        if (msg.lat) next.latitude = Number(msg.lat.toFixed(6))
        if (msg.lon) next.longitude = Number(msg.lon.toFixed(6))
        if (msg.alt !== undefined || msg.relativeAlt !== undefined) {
          next.altitude = Math.round(msg.relativeAlt ?? msg.alt)
        }
        if (msg.speed !== undefined || msg.groundspeed !== undefined) {
          next.speed = Number((msg.groundspeed ?? msg.speed).toFixed(1))
        }
        if (msg.heading !== undefined) next.heading = Math.round(msg.heading)
      }

      latestTelemetryRef.current = next
      if (msg.msgName === 'GLOBAL_POSITION_INT') {
        updateCurrentMission(next)
      }

      return next
    })
  }, [updateCurrentMission])

  // Initialize parser
  useEffect(() => {
    parserRef.current = new MavlinkParser(handleMavlinkMessage)
  }, [handleMavlinkMessage])

  useEffect(() => {
    fetchMissionLogs()
      .then((records) => setMissionLogs(records.map(formatMissionRecord)))
      .catch(() => setMissionLogs([]))

    if (!isSupabaseConfigured) return undefined

    const channel = supabase
      .channel('mission-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setMissionLogs((logs) => logs.filter((mission) => mission.databaseId !== payload.old.id))
          return
        }

        const updatedMission = formatMissionRecord(payload.new)
        setMissionLogs((logs) => {
          const exists = logs.some((mission) => mission.databaseId === updatedMission.databaseId)
          if (!exists) return [updatedMission, ...logs]
          return logs.map((mission) => mission.databaseId === updatedMission.databaseId ? updatedMission : mission)
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    const finalizeOnPageHide = () => {
      if (!missionStartRef.current || !missionDbIdRef.current) return
      finalizeMissionOnUnload(missionDbIdRef.current, {
        status: 'success',
        finished_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - missionStartRef.current) / 1000),
        distance_meters: missionDistanceRef.current,
        max_altitude_meters: missionMaxAltitudeRef.current,
        current_altitude_meters: latestTelemetryRef.current.altitude,
        start_lat: missionTrackRef.current[0]?.[0],
        start_lng: missionTrackRef.current[0]?.[1],
        finish_lat: missionTrackRef.current.at(-1)?.[0],
        finish_lng: missionTrackRef.current.at(-1)?.[1],
      })
    }
    window.addEventListener('pagehide', finalizeOnPageHide)
    return () => window.removeEventListener('pagehide', finalizeOnPageHide)
  }, [])

  const capturePhoto = useCallback((image, detections = []) => {
    if (!image) return false
    const capturedAt = new Date().toISOString()
    const capture = {
      id: `capture-${Date.now()}`,
      image,
      timestamp: new Date(capturedAt).toLocaleTimeString('en-US', { hour12: false }),
      capturedAt,
      detections,
    }
    capturesRef.current = [capture, ...capturesRef.current]
    setCurrentMission((mission) => mission ? { ...mission, captures: capturesRef.current } : mission)
    if (missionDbIdRef.current) persistCapture(missionDbIdRef.current, capture)
    else pendingCapturesRef.current.push(capture)
    return true
  }, [persistCapture])

  const markLocation = useCallback(() => {
    const { latitude, longitude, altitude, speed, heading, battery } = latestTelemetryRef.current
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
    const markedAt = new Date().toISOString()
    const marker = {
      id: `marker-${Date.now()}`,
      coordinate: [latitude, longitude],
      altitude,
      captureId: capturesRef.current[0]?.databaseId || null,
      timestamp: new Date(markedAt).toLocaleTimeString('en-US', { hour12: false }),
    }
    const lastPoint = missionTrackRef.current.at(-1)
    if (!lastPoint || lastPoint[0] !== latitude || lastPoint[1] !== longitude) {
      missionTrackRef.current = [...missionTrackRef.current, [latitude, longitude]].slice(-2000)
    }
    markedLocationsRef.current = [marker, ...markedLocationsRef.current]
    setCurrentMission((mission) => mission ? { ...mission, markedLocations: markedLocationsRef.current, trackPoints: missionTrackRef.current } : mission)
    if (missionDbIdRef.current) {
      insertTrackPoint(missionDbIdRef.current, {
        recordedAt: markedAt,
        latitude,
        longitude,
        altitudeMeters: altitude,
        speedMps: speed,
        heading,
        batteryPercent: battery,
      }).catch((error) => console.warn('Track persistence unavailable:', error.message))
      insertMarkedLocation(missionDbIdRef.current, {
        captureId: capturesRef.current[0]?.databaseId || null,
        latitude,
        longitude,
        altitudeMeters: altitude,
        markedAt,
      }).catch((error) => console.warn('Location persistence unavailable:', error.message))
    }
    return true
  }, [])

  const addTargetPoint = useCallback((point) => {
    const target = { ...point, markedAt: new Date().toISOString() }
    targetPointsRef.current = [target, ...targetPointsRef.current]
    setCurrentMission((mission) => mission ? { ...mission, targetPoints: targetPointsRef.current } : mission)
    if (missionDbIdRef.current) persistTargetPoint(missionDbIdRef.current, target)
  }, [persistTargetPoint])

  const removeTargetPoint = useCallback((id) => {
    const point = targetPointsRef.current.find((item) => item.id === id)
    targetPointsRef.current = targetPointsRef.current.filter((item) => item.id !== id)
    setCurrentMission((mission) => mission ? { ...mission, targetPoints: targetPointsRef.current } : mission)
    if (point?.databaseId) deleteTargetPoint(point.databaseId).catch((error) => console.warn('Target point deletion unavailable:', error.message))
  }, [])

  // Disconnect function
  const disconnect = useCallback(async () => {
    if (missionDbIdRef.current) {
      try {
        await updateMissionRecord(missionDbIdRef.current, {
          status: 'success',
          finishedAt: new Date().toISOString(),
          durationSeconds: Math.round((Date.now() - missionStartRef.current) / 1000),
          distanceMeters: missionDistanceRef.current,
          maxAltitudeMeters: missionMaxAltitudeRef.current,
          currentAltitudeMeters: latestTelemetryRef.current.altitude,
          startLatitude: missionTrackRef.current[0]?.[0],
          startLongitude: missionTrackRef.current[0]?.[1],
          finishLatitude: missionTrackRef.current.at(-1)?.[0],
          finishLongitude: missionTrackRef.current.at(-1)?.[1],
        })
        const records = await fetchMissionLogs()
        setMissionLogs(records.map(formatMissionRecord))
      } catch (error) {
        console.warn('Mission finalization unavailable:', error.message)
      }
    }

    if (simTimerRef.current) {
      clearInterval(simTimerRef.current)
      simTimerRef.current = null
    }

    if (readerRef.current) {
      try {
        await readerRef.current.cancel()
        readerRef.current.releaseLock()
      } catch (err) {
        console.warn('Error releasing serial reader:', err)
      }
      readerRef.current = null
    }

    if (serialPortRef.current) {
      try {
        await serialPortRef.current.close()
      } catch (err) {
        console.warn('Error closing serial port:', err)
      }
      serialPortRef.current = null
    }

    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    missionStartRef.current = null
    missionDistanceRef.current = 0
    missionMaxAltitudeRef.current = 0
    missionPositionRef.current = null
    missionTrackRef.current = []
    capturesRef.current = []
    pendingCapturesRef.current = []
    markedLocationsRef.current = []
    targetPointsRef.current = []
    missionDbIdRef.current = null
    lastTrackWriteRef.current = { at: 0, point: null }
    lastMissionSummaryWriteRef.current = 0
    setCurrentMission(null)
    setConnectionStatus('disconnected')
    setConnectionType('none')
    setErrorMessage('')
  }, [])

  // Connect via WebSerial API (USB / Telemetry Radio)
  const connectSerial = useCallback(async (baudRate = 57600) => {
    if (!('serial' in navigator)) {
      setConnectionStatus('error')
      setErrorMessage('WebSerial API is not supported in this browser (use Chrome/Edge).')
      return false
    }

    try {
      await disconnect()
      setConnectionStatus('connecting')
      setConnectionType('serial')

      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: Number(baudRate) })
      serialPortRef.current = port

      setConnectionStatus('connected')

      // Read loop
      const readLoop = async () => {
        while (port.readable && serialPortRef.current === port) {
          try {
            const reader = port.readable.getReader()
            readerRef.current = reader
            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              if (value && parserRef.current) {
                parserRef.current.parseBytes(value)
              }
            }
          } catch (err) {
            console.error('Serial read error:', err)
            break
          } finally {
            if (readerRef.current) {
              readerRef.current.releaseLock()
              readerRef.current = null
            }
          }
        }
      }

      readLoop()
      return true
    } catch (err) {
      console.error('Failed to open WebSerial port:', err)
      setConnectionStatus('error')
      setErrorMessage(err.message || 'Failed to connect to Serial/USB MAVLink device.')
      return false
    }
  }, [disconnect])

  // Connect via WebSocket MAVLink Bridge
  const connectWebSocket = useCallback(async (wsUrl = 'ws://localhost:8080') => {
    try {
      await disconnect()
      setConnectionStatus('connecting')
      setConnectionType('websocket')

      const ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        setConnectionStatus('connected')
        socketRef.current = ws
      }

      ws.onmessage = (evt) => {
        if (!parserRef.current) return
        if (evt.data instanceof ArrayBuffer) {
          parserRef.current.parseBytes(new Uint8Array(evt.data))
        } else if (typeof evt.data === 'string') {
          try {
            const json = JSON.parse(evt.data)
            if (json.msgName || json.msgId !== undefined) {
              handleMavlinkMessage(json)
            }
          } catch {
            // Raw text buffer fallback
            const encoder = new TextEncoder()
            parserRef.current.parseBytes(encoder.encode(evt.data))
          }
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket MAVLink Error:', err)
        setConnectionStatus('error')
        setErrorMessage('Failed to connect to WebSocket MAVLink Bridge.')
      }

      ws.onclose = () => {
        if (socketRef.current === ws) {
          setConnectionStatus('disconnected')
          setConnectionType('none')
        }
      }

      return true
    } catch (err) {
      setConnectionStatus('error')
      setErrorMessage(err.message || 'Failed to open WebSocket MAVLink connection.')
      return false
    }
  }, [disconnect, handleMavlinkMessage])

  // Local MAVLink Simulation Mode Engine (Long-Range Dynamic Random Search Flight)
  const enableMavlinkSim = useCallback(async () => {
    if (simTimerRef.current) return
    await disconnect()
    setConnectionStatus('connected')
    setConnectionType('simulation')


    const centerLat = -7.5950
    const centerLon = 110.4485
    const maxRadiusMeters = 3500 // 3.5 km wide exploration region

    const getNextExploreTarget = (currentLat, currentLon, currentHeading) => {
      // Pick a forward/diagonal angle within +/- 75 degrees of current heading
      const angleDeviation = (Math.random() - 0.5) * (Math.PI * 0.83)
      const currentHeadingRad = (currentHeading || 0) * (Math.PI / 180)
      let targetAngle = currentHeadingRad + angleDeviation

      // Calculate distance from center to contain flight within 3.5 km search region
      const distFromCenter = calculateDistanceMeters(currentLat, currentLon, centerLat, centerLon)
      if (distFromCenter > maxRadiusMeters * 0.75) {
        // If near boundary, steer target back inward toward center region
        const dLatCenter = (centerLat - currentLat) * 111000
        const dLonCenter = (centerLon - currentLon) * 111000 * Math.cos(currentLat * (Math.PI / 180))
        targetAngle = Math.atan2(dLonCenter, dLatCenter) + (Math.random() - 0.5) * 0.6
      }

      // Long-range leg distance: 800m - 1800m across the map
      const legDist = 800 + Math.random() * 1000

      const targetLat = currentLat + (legDist * Math.cos(targetAngle)) / 111000
      const targetLon = currentLon + (legDist * Math.sin(targetAngle)) / (111000 * Math.cos(currentLat * (Math.PI / 180)))

      return { lat: targetLat, lon: targetLon }
    }

    const initialTarget = getNextExploreTarget(centerLat, centerLon, 45)

    const baseAltitude = 88 + Math.random() * 10
    const altitudeAmplitude = 14 + Math.random() * 10

    simStateRef.current = {
      lat: centerLat,
      lon: centerLon,
      heading: 45,
      speed: 25,
      targetWp: initialTarget,
      centerLat,
      centerLon,
      maxRadiusMeters,
      getNextExploreTarget,
      baseAltitude,
      altitudeAmplitude,
    }

    simTimerRef.current = setInterval(() => {
      if (!parserRef.current) return

      seqRef.current = (seqRef.current + 1) % 256
      const seq = seqRef.current
      const timeMs = Math.floor(performance.now())

      const st = simStateRef.current

      // Distance to current dynamic random target
      const dLat = (st.targetWp.lat - st.lat) * 111000
      const dLon = (st.targetWp.lon - st.lon) * 111000 * Math.cos(st.lat * (Math.PI / 180))
      const distToTarget = Math.sqrt(dLat * dLat + dLon * dLon)

      // Distance from origin center
      const distFromCenter = calculateDistanceMeters(st.lat, st.lon, st.centerLat, st.centerLon)

      // If reached target (< 40m) or past max boundary, pick next long-range target in current direction
      if (distToTarget < 40 || distFromCenter > st.maxRadiusMeters) {
        st.targetWp = st.getNextExploreTarget(st.lat, st.lon, st.heading)
        st.speed = Number((22 + Math.random() * 10).toFixed(1)) // Speed 22-32 m/s (80-115 km/h)
      }

      const targetDLat = (st.targetWp.lat - st.lat) * 111000
      const targetDLon = (st.targetWp.lon - st.lon) * 111000 * Math.cos(st.lat * (Math.PI / 180))

      let targetHeading = Math.atan2(targetDLon, targetDLat) * (180 / Math.PI)
      if (targetHeading < 0) targetHeading += 360

      let diff = (targetHeading - st.heading + 540) % 360 - 180
      const maxTurnRate = 3.8
      if (Math.abs(diff) > maxTurnRate) {
        st.heading = (st.heading + Math.sign(diff) * maxTurnRate + 360) % 360
      } else {
        st.heading = targetHeading
      }

      const currentHeading = Math.round(st.heading)
      const headingRad = currentHeading * (Math.PI / 180)

      const dt = 0.2
      const distanceMeters = st.speed * dt
      const moveLat = (distanceMeters * Math.cos(headingRad)) / 111000
      const moveLon = (distanceMeters * Math.sin(headingRad)) / (111000 * Math.cos(st.lat * (Math.PI / 180)))

      st.lat += moveLat
      st.lon += moveLon

      // 1. HEARTBEAT MAVLink Frame
      const hbPayload = new Uint8Array(9)
      const hbView = new DataView(hbPayload.buffer)
      hbView.setUint32(0, 3, true) // Mode AUTO
      hbView.setUint8(4, 2) // Quadrotor
      hbView.setUint8(5, 3) // ArduPilot
      hbView.setUint8(6, 209)
      hbView.setUint8(7, 4) // Active
      hbView.setUint8(8, 3)
      const hbFrame = encodeMavlink2Frame(MAVMSG.HEARTBEAT, hbPayload, 1, 1, seq)
      parserRef.current.parseBytes(hbFrame)

      // 2. ATTITUDE MAVLink Frame
      const attPayload = new Uint8Array(28)
      const attView = new DataView(attPayload.buffer)
      attView.setUint32(0, timeMs & 0xffffffff, true)
      attView.setFloat32(4, Math.sin(timeMs / 1000) * 0.04, true)
      attView.setFloat32(8, -0.05, true)
      attView.setFloat32(12, headingRad, true)
      const attFrame = encodeMavlink2Frame(MAVMSG.ATTITUDE, attPayload, 1, 1, seq)
      parserRef.current.parseBytes(attFrame)

      // 3. GLOBAL_POSITION_INT MAVLink Frame
      const posPayload = new Uint8Array(28)
      const posView = new DataView(posPayload.buffer)
      posView.setUint32(0, timeMs & 0xffffffff, true)
      const simLat = Math.round(st.lat * 1e7)
      const simLon = Math.round(st.lon * 1e7)
      const simAltitude = Math.round(st.baseAltitude + Math.sin(timeMs / 7000) * st.altitudeAmplitude)
      posView.setInt32(4, simLat, true)
      posView.setInt32(8, simLon, true)
      posView.setInt32(12, (simAltitude + 25) * 1000, true)
      posView.setInt32(16, simAltitude * 1000, true)
      posView.setInt16(20, Math.round(st.speed * Math.cos(headingRad) * 100), true)
      posView.setInt16(22, Math.round(st.speed * Math.sin(headingRad) * 100), true)
      posView.setInt16(24, 0, true)
      posView.setUint16(26, currentHeading * 100, true)
      const posFrame = encodeMavlink2Frame(MAVMSG.GLOBAL_POSITION_INT, posPayload, 1, 1, seq)
      parserRef.current.parseBytes(posFrame)

      // 4. SYS_STATUS MAVLink Frame
      const sysPayload = new Uint8Array(31)
      const sysView = new DataView(sysPayload.buffer)
      sysView.setUint16(12, 350, true)
      sysView.setUint16(14, 15400, true)
      sysView.setInt16(16, 1420, true)
      sysView.setInt8(18, 78)
      const sysFrame = encodeMavlink2Frame(MAVMSG.SYS_STATUS, sysPayload, 1, 1, seq)
      parserRef.current.parseBytes(sysFrame)
    }, 200)
  }, [disconnect])

  // Auto-start simulation mode on initial mount
  useEffect(() => {
    enableMavlinkSim()
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current)
      simTimerRef.current = null
    }
  }, [enableMavlinkSim])

  return {
    telemetry,
    connectionStatus,
    connectionType,
    errorMessage,
    missionLogs,
    currentMission,
    capturePhoto,
    markLocation,
    addTargetPoint,
    removeTargetPoint,
    connectSerial,
    connectWebSocket,
    enableMavlinkSim,
    disconnect,
  }
}

