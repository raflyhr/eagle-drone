const CRSF = {
  GPS: 0x02,
  BATTERY: 0x08,
  LINK_STATISTICS: 0x14,
  ATTITUDE: 0x1e,
  FLIGHT_MODE: 0x21,
}

function crc8(bytes) {
  let crc = 0
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x80 ? (crc << 1 ^ 0xd5) & 0xff : crc << 1 & 0xff
  }
  return crc
}

function decodeMessage(type, payload) {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)

  if (type === CRSF.GPS && payload.length >= 15) {
    return {
      type: 'gps',
      latitude: view.getInt32(0, false) / 10000000,
      longitude: view.getInt32(4, false) / 10000000,
      speed: view.getUint16(8, false) / 36,
      heading: view.getUint16(10, false) / 100,
      altitude: view.getUint16(12, false) - 1000,
      satellites: payload[14],
      fix: payload[14] >= 4 && Math.abs(view.getInt32(0, false)) <= 900000000 && Math.abs(view.getInt32(4, false)) <= 1800000000,
    }
  }
  if (type === CRSF.BATTERY && payload.length >= 8) {
    return {
      type: 'battery',
      voltage: view.getUint16(0, false) / 10,
      current: view.getUint16(2, false) / 10,
      capacity: payload[4] << 16 | payload[5] << 8 | payload[6],
      battery: payload[7] || null,
    }
  }
  if (type === CRSF.LINK_STATISTICS && payload.length >= 10) {
    return {
      type: 'link',
      rssi1: -payload[0],
      rssi2: -payload[1],
      linkQuality: payload[2],
      snr: view.getInt8(3),
      antenna: payload[4],
      rfMode: payload[5],
      txPower: payload[6],
      downlinkRssi: -payload[7],
      downlinkQuality: payload[8],
      downlinkSnr: view.getInt8(9),
    }
  }
  if (type === CRSF.ATTITUDE && payload.length >= 6) {
    const toDegrees = 180 / Math.PI / 10000
    return {
      type: 'attitude',
      pitch: view.getInt16(0, false) * toDegrees,
      roll: view.getInt16(2, false) * toDegrees,
      yaw: view.getInt16(4, false) * toDegrees,
    }
  }
  if (type === CRSF.FLIGHT_MODE) {
    return { type: 'flightMode', flightMode: new TextDecoder().decode(payload).replace(/\0/g, '').trim() }
  }
  return null
}

export class CrsfParser {
  constructor(onMessage) {
    this.onMessage = onMessage
    this.buffer = new Uint8Array(0)
  }

  parseBytes(bytes) {
    const next = new Uint8Array(this.buffer.length + bytes.length)
    next.set(this.buffer)
    next.set(bytes, this.buffer.length)
    this.buffer = next

    while (this.buffer.length >= 5) {
      const start = this.buffer.findIndex((_, index) => {
        const length = this.buffer[index + 1]
        return length >= 2 && length <= 64
      })
      if (start < 0) {
        this.buffer = this.buffer.slice(-1)
        return
      }
      if (start > 0) this.buffer = this.buffer.slice(start)
      const length = this.buffer[1]
      const frameLength = length + 2
      if (this.buffer.length < frameLength) return
      const frame = this.buffer.slice(0, frameLength)
      if (crc8(frame.slice(2, frameLength - 1)) !== frame[frameLength - 1]) {
        this.buffer = this.buffer.slice(1)
        continue
      }
      this.buffer = this.buffer.slice(frameLength)
      const message = decodeMessage(frame[2], frame.slice(3, frameLength - 1))
      if (message) this.onMessage(message)
    }
  }
}

export { CRSF }
