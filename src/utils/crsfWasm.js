let modulePromise

export async function createCrsfWasmParser(onMessage) {
  modulePromise ||= fetch('/wasm/crsf.js')
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load CRSF WASM loader (${response.status})`)
      return response.text()
    })
    .then((source) => import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))))
    .then(({ default: factory }) => factory({ locateFile: (file) => `/wasm/${file}` }))
  const wasm = await modulePromise
  const input = wasm._malloc(256)
  const frame = wasm._malloc(64)
  const values = wasm._malloc(6 * 4)
  const readLength = wasm._malloc(4)
  let buffer = new Uint8Array(0)

  let destroyed = false
  return {
    parseBytes(bytes) {
      if (destroyed || !bytes?.length) return
      const next = new Uint8Array(buffer.length + bytes.length)
      next.set(buffer)
      next.set(bytes, buffer.length)
      buffer = next
      while (buffer.length >= 5) {
        if (buffer[0] !== 0xc8) {
          buffer = buffer.slice(1)
          continue
        }
        const expectedLength = buffer[1] + 2
        if (buffer[1] < 2 || buffer[1] > 62) {
          buffer = buffer.slice(1)
          continue
        }
        if (buffer.length < expectedLength) return
        const size = Math.min(buffer.length, 256)
        wasm.HEAPU8.set(buffer.subarray(0, size), input)
        if (!wasm._crsf_wasm_parse(input, size, frame, readLength)) {
          buffer = buffer.slice(1)
          continue
        }
        const type = wasm._crsf_wasm_type(frame)
        const count = wasm._crsf_wasm_decode(frame, values, 6)
        const data = wasm.HEAPF32.slice(values >> 2, (values >> 2) + count)
        buffer = buffer.slice(wasm._crsf_wasm_frame_length(frame))
        if (type === 2 && count >= 6) onMessage({ type: 'gps', latitude: data[0], longitude: data[1], speed: data[2], heading: data[3], altitude: data[4], satellites: data[5], fix: data[5] >= 4 })
        if (type === 8 && count >= 4) onMessage({ type: 'battery', voltage: data[0], current: data[1], capacity: data[2], battery: data[3] || null })
        if (type === 30 && count >= 3) onMessage({ type: 'attitude', pitch: data[0], roll: data[1], yaw: data[2] })
        if (type === 20 && count >= 3) onMessage({ type: 'link', rssi1: data[0], linkQuality: data[1], snr: data[2] })
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      wasm._free(input)
      wasm._free(frame)
      wasm._free(values)
      wasm._free(readLength)
    },
  }
}
