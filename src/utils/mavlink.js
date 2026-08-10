/**
 * MAVLink v1 & v2 Protocol Parser & Decoder Utility
 * Protocol Specifications:
 * MAVLink 1 STX: 0xFE
 * MAVLink 2 STX: 0xFD
 */

export const MAVLINK_STX_V1 = 0xfe
export const MAVLINK_STX_V2 = 0xfd

export const MAVMSG = {
  HEARTBEAT: 0,
  SYS_STATUS: 1,
  GPS_RAW_INT: 24,
  ATTITUDE: 30,
  GLOBAL_POSITION_INT: 33,
  VFR_HUD: 74,
}

// Flight Mode Mapping (ArduPilot Copter/Plane defaults)
export const FLIGHT_MODES = {
  0: 'STABILIZE',
  1: 'ACRO',
  2: 'ALT_HOLD',
  3: 'AUTO',
  4: 'GUIDED',
  5: 'LOITER',
  6: 'RTL',
  7: 'CIRCLE',
  9: 'LAND',
  11: 'DRIFT',
  16: 'POSHOLD',
}

// GPS Fix Type Mapping
export const GPS_FIX_TYPES = {
  0: 'No GPS',
  1: 'No Fix',
  2: '2D Fix',
  3: '3D Fix',
  4: 'DGPS',
  5: 'RTK Float',
  6: 'RTK Fixed',
}

/**
 * MAVLink Packet Parser
 */
export class MavlinkParser {
  constructor(onMessage) {
    this.onMessage = onMessage
    this.buffer = new Uint8Array(1024)
    this.bufferLen = 0
    this.seq = 0
    this.sysId = 1
    this.compId = 1
  }

  parseBytes(dataViewOrUint8Array) {
    const bytes = dataViewOrUint8Array instanceof Uint8Array
      ? dataViewOrUint8Array
      : new Uint8Array(dataViewOrUint8Array.buffer, dataViewOrUint8Array.byteOffset, dataViewOrUint8Array.byteLength)

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]

      // Detect STX byte
      if (this.bufferLen === 0) {
        if (byte === MAVLINK_STX_V1 || byte === MAVLINK_STX_V2) {
          this.buffer[0] = byte
          this.bufferLen = 1
        }
        continue
      }

      this.buffer[this.bufferLen++] = byte
      const stx = this.buffer[0]

      if (stx === MAVLINK_STX_V1) {
        if (this.bufferLen >= 6) {
          const payloadLen = this.buffer[1]
          const totalPacketLen = 6 + payloadLen + 2 // STX(1)+LEN(1)+SEQ(1)+SYS(1)+COMP(1)+MSGID(1) + payload + checksum(2)
          if (this.bufferLen >= totalPacketLen) {
            this._decodePacketV1(payloadLen)
            this._slideBuffer(totalPacketLen)
          }
        }
      } else if (stx === MAVLINK_STX_V2) {
        if (this.bufferLen >= 10) {
          const payloadLen = this.buffer[1]
          const totalPacketLen = 10 + payloadLen + 2 // STX(1)+LEN(1)+FLAGS(2)+SEQ(1)+SYS(1)+COMP(1)+MSGID(3) + payload + checksum(2)
          if (this.bufferLen >= totalPacketLen) {
            this._decodePacketV2(payloadLen)
            this._slideBuffer(totalPacketLen)
          }
        }
      }

      // Safety buffer flush if corrupted
      if (this.bufferLen >= 512) {
        this.bufferLen = 0
      }
    }
  }

  _slideBuffer(length) {
    if (length >= this.bufferLen) {
      this.bufferLen = 0
    } else {
      this.buffer.copyWithin(0, length, this.bufferLen)
      this.bufferLen -= length
    }
  }

  _decodePacketV1(payloadLen) {
    const sysId = this.buffer[3]
    const compId = this.buffer[4]
    const msgId = this.buffer[5]
    const payload = this.buffer.slice(6, 6 + payloadLen)
    this._handleDecodedMessage(msgId, payload, sysId, compId, 1)
  }

  _decodePacketV2(payloadLen) {
    const sysId = this.buffer[5]
    const compId = this.buffer[6]
    const msgId = this.buffer[7] | (this.buffer[8] << 8) | (this.buffer[9] << 16)
    const payload = this.buffer.slice(10, 10 + payloadLen)
    this._handleDecodedMessage(msgId, payload, sysId, compId, 2)
  }

  _handleDecodedMessage(msgId, payload, sysId, compId, version) {
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
    let decodedData = null

    try {
      switch (msgId) {
        case MAVMSG.HEARTBEAT:
          if (payload.byteLength >= 9) {
            const customMode = view.getUint32(0, true)
            const type = view.getUint8(4)
            const autopilot = view.getUint8(5)
            const baseMode = view.getUint8(6)
            const systemStatus = view.getUint8(7)
            const mavlinkVersion = view.getUint8(8)

            decodedData = {
              msgId,
              msgName: 'HEARTBEAT',
              customMode,
              flightMode: FLIGHT_MODES[customMode] || `MODE_${customMode}`,
              type,
              autopilot,
              baseMode,
              systemStatus,
              mavlinkVersion,
            }
          }
          break

        case MAVMSG.SYS_STATUS:
          if (payload.byteLength >= 31) {
            const load = view.getUint16(12, true) / 10 // %
            const voltageBattery = view.getUint16(14, true) / 1000 // Volts
            const currentBattery = view.getInt16(16, true) / 100 // Amperes
            const batteryRemaining = view.getInt8(18) // %

            decodedData = {
              msgId,
              msgName: 'SYS_STATUS',
              load,
              voltageBattery,
              currentBattery,
              batteryRemaining: batteryRemaining < 0 ? 0 : batteryRemaining,
            }
          }
          break

        case MAVMSG.GPS_RAW_INT:
          if (payload.byteLength >= 30) {
            const fixType = view.getUint8(8)
            const lat = view.getInt32(9, true) / 1e7
            const lon = view.getInt32(13, true) / 1e7
            const alt = view.getInt32(17, true) / 1000 // meters
            const eph = view.getUint16(21, true) / 100 // HDOP
            const vel = view.getUint16(25, true) / 100 // m/s
            const cog = view.getUint16(27, true) / 100 // degrees
            const satellitesVisible = view.getUint8(29)

            decodedData = {
              msgId,
              msgName: 'GPS_RAW_INT',
              fixType,
              fixLabel: GPS_FIX_TYPES[fixType] || 'Unknown',
              lat,
              lon,
              alt,
              hdop: eph,
              speed: vel,
              heading: cog,
              satellitesVisible,
            }
          }
          break

        case MAVMSG.ATTITUDE:
          if (payload.byteLength >= 28) {
            const rollRad = view.getFloat32(4, true)
            const pitchRad = view.getFloat32(8, true)
            const yawRad = view.getFloat32(12, true)

            decodedData = {
              msgId,
              msgName: 'ATTITUDE',
              roll: Number((rollRad * (180 / Math.PI)).toFixed(1)),
              pitch: Number((pitchRad * (180 / Math.PI)).toFixed(1)),
              yaw: Number((((yawRad * (180 / Math.PI)) + 360) % 360).toFixed(1)),
            }
          }
          break

        case MAVMSG.GLOBAL_POSITION_INT:
          if (payload.byteLength >= 28) {
            const lat = view.getInt32(4, true) / 1e7
            const lon = view.getInt32(8, true) / 1e7
            const altMSL = view.getInt32(12, true) / 1000
            const relativeAlt = view.getInt32(16, true) / 1000
            const vx = view.getInt16(20, true) / 100
            const vy = view.getInt16(22, true) / 100
            const groundspeed = Number(Math.sqrt(vx * vx + vy * vy).toFixed(1))
            const hdg = view.getUint16(26, true) / 100

            decodedData = {
              msgId,
              msgName: 'GLOBAL_POSITION_INT',
              lat,
              lon,
              altMSL,
              relativeAlt,
              speed: groundspeed,
              heading: hdg,
            }
          }
          break

        case MAVMSG.VFR_HUD:
          if (payload.byteLength >= 20) {
            const airspeed = view.getFloat32(0, true)
            const groundspeed = view.getFloat32(4, true)
            const heading = view.getInt16(8, true)
            const throttle = view.getUint16(10, true)
            const alt = view.getFloat32(12, true)
            const climb = view.getFloat32(16, true)

            decodedData = {
              msgId,
              msgName: 'VFR_HUD',
              airspeed: Number(airspeed.toFixed(1)),
              groundspeed: Number(groundspeed.toFixed(1)),
              heading,
              throttle,
              alt: Number(alt.toFixed(1)),
              climb: Number(climb.toFixed(1)),
            }
          }
          break

        default:
          decodedData = { msgId, rawPayloadLen: payload.byteLength }
          break
      }

      if (decodedData && typeof this.onMessage === 'function') {
        this.onMessage({
          ...decodedData,
          sysId,
          compId,
          mavlinkVersion: version,
          timestamp: Date.now(),
        })
      }
    } catch (err) {
      console.warn('Error parsing MAVLink payload:', err)
    }
  }
}

/**
 * Helper to encode MAVLink v2 frames for testing / simulation
 */
export function encodeMavlink2Frame(msgId, payloadBytes, sysId = 1, compId = 1, seq = 0) {
  const len = payloadBytes.length
  const packet = new Uint8Array(10 + len + 2)
  packet[0] = MAVLINK_STX_V2
  packet[1] = len
  packet[2] = 0
  packet[3] = 0
  packet[4] = seq & 0xff
  packet[5] = sysId & 0xff
  packet[6] = compId & 0xff
  packet[7] = msgId & 0xff
  packet[8] = (msgId >> 8) & 0xff
  packet[9] = (msgId >> 16) & 0xff

  for (let i = 0; i < len; i++) {
    packet[10 + i] = payloadBytes[i]
  }

  packet[10 + len] = 0xaa
  packet[10 + len + 1] = 0xbb

  return packet
}
