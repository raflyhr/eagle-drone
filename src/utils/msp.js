const MSP = {
  API_VERSION: 1,
  FC_VARIANT: 2,
  FC_VERSION: 3,
  RAW_GPS: 106,
  ATTITUDE: 108,
  ALTITUDE: 109,
  ANALOG: 110,
  BOXNAMES: 116,
  BOXIDS: 119,
  BATTERY_STATE: 130,
  STATUS: 101,
  STATUS_EX: 150,
}

function readI16(view, offset) {
  return view.getInt16(offset, true)
}

function readU16(view, offset) {
  return view.getUint16(offset, true)
}

function readI32(view, offset) {
  return view.getInt32(offset, true)
}

function readU32(view, offset) {
  return view.getUint32(offset, true)
}

function readString(payload) {
  return new TextDecoder().decode(payload).replace(/\0/g, '').trim()
}

function decodeStatus(payload) {
  if (payload.length < 11) return {}
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  return { modeFlags: readU32(view, 6) }
}

function decodeStatusEx(payload) {
  if (payload.length < 15) return decodeStatus(payload)
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  return { modeFlags: readU32(view, 6), armingFlags: readU32(view, 10) }
}

function decodeMessage(command, payload) {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)

  if (command === MSP.API_VERSION && payload.length >= 3) {
    return { type: 'api', version: `${payload[1]}.${payload[2]}` }
  }
  if (command === MSP.FC_VARIANT) return { type: 'variant', variant: readString(payload) }
  if (command === MSP.FC_VERSION) return { type: 'version', version: Array.from(payload.slice(0, 3)).join('.') }
  if (command === MSP.ATTITUDE && payload.length >= 6) {
    return { type: 'attitude', roll: readI16(view, 0) / 10, pitch: readI16(view, 2) / 10, heading: readI16(view, 4) }
  }
  if (command === MSP.ALTITUDE && payload.length >= 6) {
    return { type: 'altitude', altitude: readI32(view, 0) / 100, vario: readI16(view, 4) / 100 }
  }
  if (command === MSP.RAW_GPS && payload.length >= 16) {
    const fix = payload[0]
    const satellites = payload[1]
    return {
      type: 'gps',
      fix,
      satellites,
      latitude: readI32(view, 2) / 10000000,
      longitude: readI32(view, 6) / 10000000,
      altitude: readU16(view, 10),
      speed: readU16(view, 12) / 100,
      heading: readU16(view, 14) / 10,
    }
  }
  if (command === MSP.ANALOG && payload.length >= 7) {
    return { type: 'analog', voltage: payload[0] / 10, current: readI16(view, 5) / 100, rssi: readU16(view, 3) }
  }
  if (command === MSP.BATTERY_STATE && payload.length >= 10) {
    return { type: 'battery', voltage: readU16(view, 2) / 100, current: readI16(view, 4) / 100, capacity: readU16(view, 6), battery: payload[9] }
  }
  if (command === MSP.STATUS || command === MSP.STATUS_EX) {
    return { type: 'status', ...(command === MSP.STATUS_EX ? decodeStatusEx(payload) : decodeStatus(payload)) }
  }
  if (command === MSP.BOXNAMES) return { type: 'boxNames', names: readString(payload).split(';').filter(Boolean) }
  if (command === MSP.BOXIDS) return { type: 'boxIds', ids: Array.from(payload) }
  return null
}

export function encodeMspRequest(command) {
  return new Uint8Array([36, 77, 60, 0, command, command])
}

export class MspParser {
  constructor(onMessage) {
    this.onMessage = onMessage
    this.buffer = new Uint8Array(0)
  }

  parseBytes(bytes) {
    const next = new Uint8Array(this.buffer.length + bytes.length)
    next.set(this.buffer)
    next.set(bytes, this.buffer.length)
    this.buffer = next

    while (this.buffer.length >= 6) {
      const start = this.buffer.findIndex((value, index) => value === 36 && this.buffer[index + 1] === 77)
      if (start < 0) {
        this.buffer = this.buffer.slice(-2)
        return
      }
      if (start > 0) this.buffer = this.buffer.slice(start)
      if (this.buffer.length < 6) return
      const length = this.buffer[3]
      const frameLength = 6 + length
      if (this.buffer.length < frameLength) return
      const frame = this.buffer.slice(0, frameLength)
      this.buffer = this.buffer.slice(frameLength)
      let checksum = 0
      for (let index = 3; index < 5 + length; index += 1) checksum ^= frame[index]
      if (checksum !== frame[5 + length]) continue
      const message = decodeMessage(frame[4], frame.slice(5, 5 + length))
      if (message) this.onMessage(message)
    }
  }
}

export { MSP }
