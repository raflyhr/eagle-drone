import { useCallback, useEffect, useRef, useState } from 'react'
import { encodeMavlink2Frame, MAVMSG, MavlinkParser } from '../utils/mavlink'

const MERAPI_SAR_PATROL_WAYPOINTS = [
  { name: 'Posko Utama SAR Kaliurang (Base Camp)', lat: -7.5950, lon: 110.4485 },
  { name: 'Bunker Kaliurang (Sector Alpha)', lat: -7.5852, lon: 110.4462 },
  { name: 'Kali Gendol Lava Gully (Sector Bravo)', lat: -7.5680, lon: 110.4520 },
  { name: 'Kawah Puncak Merapi (Summit Ridge)', lat: -7.5407, lon: 110.4457 },
  { name: 'Pasar Bubrah (Summit Checkpoint)', lat: -7.5450, lon: 110.4400 },
  { name: 'Kali Bebeng Search Grid (Sector Charlie)', lat: -7.5650, lon: 110.4350 },
  { name: 'Pos Babadan (Sector Delta)', lat: -7.5410, lon: 110.3790 },
  { name: 'Bukit Turgo (Sector Echo Search)', lat: -7.6010, lon: 110.4280 },
]

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

  const serialPortRef = useRef(null)
  const readerRef = useRef(null)
  const socketRef = useRef(null)
  const parserRef = useRef(null)
  const simTimerRef = useRef(null)
  const seqRef = useRef(0)
  const simStateRef = useRef({
    lat: -7.5950,
    lon: 110.4485,
    heading: 0,
    speed: 22,
    wpIndex: 1,
  })

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

      return next
    })
  }, [])

  // Initialize parser
  useEffect(() => {
    parserRef.current = new MavlinkParser(handleMavlinkMessage)
  }, [handleMavlinkMessage])

  // Disconnect function
  const disconnect = useCallback(async () => {
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

    setConnectionStatus('disconnected')
    setConnectionType('none')
    setErrorMessage('')
  }, [])

  // Connect via WebSerial API (USB / Telemetry Radio)
  const connectSerial = useCallback(async (baudRate = 57600) => {
    if (!('serial' in navigator)) {
      setConnectionStatus('error')
      setErrorMessage('WebSerial API tidak didukung oleh browser ini (gunakan Chrome/Edge).')
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
      setErrorMessage(err.message || 'Gagal menyambungkan perangkat Serial/USB MAVLink.')
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
        setErrorMessage('Gagal terhubung ke WebSocket MAVLink Bridge.')
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
      setErrorMessage(err.message || 'Gagal membuka WebSocket MAVLink.')
      return false
    }
  }, [disconnect, handleMavlinkMessage])

  // Local MAVLink Simulation Mode Engine (Yogyakarta Patrol Route Waypoint Navigation)
  const enableMavlinkSim = useCallback(async () => {
    await disconnect()
    setConnectionStatus('connected')
    setConnectionType('simulation')

    // Reset initial simulation coordinates to Posko SAR Kaliurang Base Camp
    simStateRef.current = {
      lat: -7.5950,
      lon: 110.4485,
      heading: 0,
      speed: 22,
      wpIndex: 1,
    }

    simTimerRef.current = setInterval(() => {
      if (!parserRef.current) return

      seqRef.current = (seqRef.current + 1) % 256
      const seq = seqRef.current
      const timeMs = Math.floor(performance.now())

      const st = simStateRef.current
      const targetWp = MERAPI_SAR_PATROL_WAYPOINTS[st.wpIndex]

      // Distance to target waypoint
      const dLatMeters = (targetWp.lat - st.lat) * 111000
      const dLonMeters = (targetWp.lon - st.lon) * 111000 * Math.cos(st.lat * (Math.PI / 180))
      const distToWp = Math.sqrt(dLatMeters * dLatMeters + dLonMeters * dLonMeters)

      // Reach waypoint -> target next landmark
      if (distToWp < 50) {
        st.wpIndex = (st.wpIndex + 1) % MERAPI_SAR_PATROL_WAYPOINTS.length
      }

      // Calculate bearing angle to target waypoint
      let targetHeading = Math.atan2(dLonMeters, dLatMeters) * (180 / Math.PI)
      if (targetHeading < 0) targetHeading += 360

      // Smoothly bank heading towards target waypoint
      let diff = (targetHeading - st.heading + 540) % 360 - 180
      const maxTurnRate = 3.5 // 3.5 deg per 200ms tick
      if (Math.abs(diff) > maxTurnRate) {
        st.heading = (st.heading + Math.sign(diff) * maxTurnRate + 360) % 360
      } else {
        st.heading = targetHeading
      }

      const currentHeading = Math.round(st.heading)
      const headingRad = currentHeading * (Math.PI / 180)

      // Step forward by 3.6 meters (18 m/s * 0.2s tick interval) along heading vector
      const dt = 0.2
      const distanceMeters = st.speed * dt
      const moveLat = (distanceMeters * Math.cos(headingRad)) / 111000
      const moveLon = (distanceMeters * Math.sin(headingRad)) / (111000 * Math.cos(st.lat * (Math.PI / 180)))

      st.lat += moveLat
      st.lon += moveLon

      // 1. HEARTBEAT MAVLink Frame
      const hbPayload = new Uint8Array(9)
      const hbView = new DataView(hbPayload.buffer)
      hbView.setUint32(0, 3, true) // Custom Mode 3 = AUTO
      hbView.setUint8(4, 2) // Type 2 = Quadrotor
      hbView.setUint8(5, 3) // Autopilot 3 = ArduPilot
      hbView.setUint8(6, 209) // Base mode
      hbView.setUint8(7, 4) // System Status 4 = Active
      hbView.setUint8(8, 3) // Mavlink Version
      const hbFrame = encodeMavlink2Frame(MAVMSG.HEARTBEAT, hbPayload, 1, 1, seq)
      parserRef.current.parseBytes(hbFrame)

      // 2. ATTITUDE MAVLink Frame
      const attPayload = new Uint8Array(28)
      const attView = new DataView(attPayload.buffer)
      attView.setUint32(0, timeMs & 0xffffffff, true)
      attView.setFloat32(4, Math.sin(timeMs / 1000) * 0.04, true) // Roll rad
      attView.setFloat32(8, -0.05, true) // Pitch forward pitch
      attView.setFloat32(12, headingRad, true) // Yaw rad (synced with heading)
      const attFrame = encodeMavlink2Frame(MAVMSG.ATTITUDE, attPayload, 1, 1, seq)
      parserRef.current.parseBytes(attFrame)

      // 3. GLOBAL_POSITION_INT MAVLink Frame
      const posPayload = new Uint8Array(28)
      const posView = new DataView(posPayload.buffer)
      posView.setUint32(0, timeMs & 0xffffffff, true)
      const simLat = Math.round(st.lat * 1e7)
      const simLon = Math.round(st.lon * 1e7)
      posView.setInt32(4, simLat, true)
      posView.setInt32(8, simLon, true)
      posView.setInt32(12, 145000, true) // 145m MSL
      posView.setInt32(16, 120000, true) // 120m relative
      posView.setInt16(20, Math.round(st.speed * Math.cos(headingRad) * 100), true) // vx (m/s * 100)
      posView.setInt16(22, Math.round(st.speed * Math.sin(headingRad) * 100), true) // vy (m/s * 100)
      posView.setInt16(24, 0, true) // vz
      posView.setUint16(26, currentHeading * 100, true) // hdg in cdeg
      const posFrame = encodeMavlink2Frame(MAVMSG.GLOBAL_POSITION_INT, posPayload, 1, 1, seq)
      parserRef.current.parseBytes(posFrame)

      // 4. SYS_STATUS MAVLink Frame
      const sysPayload = new Uint8Array(31)
      const sysView = new DataView(sysPayload.buffer)
      sysView.setUint16(12, 350, true) // 35% CPU load
      sysView.setUint16(14, 15400, true) // 15.4V
      sysView.setInt16(16, 1420, true) // 14.2A
      sysView.setInt8(18, 78) // 78% remaining
      const sysFrame = encodeMavlink2Frame(MAVMSG.SYS_STATUS, sysPayload, 1, 1, seq)
      parserRef.current.parseBytes(sysFrame)
    }, 200)
  }, [disconnect])

  // Auto-start simulation mode on initial mount
  useEffect(() => {
    enableMavlinkSim()
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current)
    }
  }, [enableMavlinkSim])

  return {
    telemetry,
    connectionStatus,
    connectionType,
    errorMessage,
    connectSerial,
    connectWebSocket,
    enableMavlinkSim,
    disconnect,
  }
}
