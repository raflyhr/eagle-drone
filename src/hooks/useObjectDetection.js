import { useEffect, useRef, useState } from 'react'
import * as ort from 'onnxruntime-web'

// Konfigurasi ONNX Runtime WASM (Versi 1.27.0 sesuai package yang terinstall)
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'
ort.env.wasm.numThreads = 1

// Path ke model ONNX di public/models/
const MODEL_URL = '/models/yolo_sar.onnx'

// Ukuran input model (YOLO11 standard 640x640)
const MODEL_INPUT_SIZE = 640

// Threshold deteksi
const CONFIDENCE_THRESHOLD = 0.35
const IOU_THRESHOLD = 0.45

// Class names (sesuai dataset SAR)
const CLASS_NAMES = ['person']

/**
 * Pre-process frame video jadi tensor [1, 3, 640, 640] normalized 0–1
 */
function preprocessFrame(video, inputSize) {
  const canvas = document.createElement('canvas')
  canvas.width = inputSize
  canvas.height = inputSize
  const ctx = canvas.getContext('2d')

  // Letterbox: resize dengan aspect ratio tetap, padding hitam
  const vw = video.videoWidth
  const vh = video.videoHeight
  const scale = Math.min(inputSize / vw, inputSize / vh)
  const newW = Math.round(vw * scale)
  const newH = Math.round(vh * scale)
  const padX = (inputSize - newW) / 2
  const padY = (inputSize - newH) / 2

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, inputSize, inputSize)
  ctx.drawImage(video, padX, padY, newW, newH)

  const imageData = ctx.getImageData(0, 0, inputSize, inputSize)
  const { data } = imageData

  // HWC → CHW, normalize 0–1
  const channelSize = inputSize * inputSize
  const float32 = new Float32Array(3 * channelSize)
  for (let i = 0; i < channelSize; i++) {
    float32[i] = data[i * 4] / 255             // R
    float32[i + channelSize] = data[i * 4 + 1] / 255     // G
    float32[i + 2 * channelSize] = data[i * 4 + 2] / 255 // B
  }

  return {
    tensor: new ort.Tensor('float32', float32, [1, 3, inputSize, inputSize]),
    scale,
    padX,
    padY,
  }
}

/**
 * IoU (Intersection over Union) untuk NMS
 */
function iou(a, b) {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[0] + a[2], b[0] + b[2])
  const y2 = Math.min(a[1] + a[3], b[1] + b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const aArea = a[2] * a[3]
  const bArea = b[2] * b[3]
  return inter / (aArea + bArea - inter)
}

/**
 * Non-Maximum Suppression
 */
function nms(boxes, iouThreshold) {
  boxes.sort((a, b) => b.score - a.score)
  const kept = []
  const suppressed = new Set()
  for (let i = 0; i < boxes.length; i++) {
    if (suppressed.has(i)) continue
    kept.push(boxes[i])
    for (let j = i + 1; j < boxes.length; j++) {
      if (!suppressed.has(j) && iou(boxes[i].bbox, boxes[j].bbox) > iouThreshold) {
        suppressed.add(j)
      }
    }
  }
  return kept
}

/**
 * Post-process output YOLO: decode boxes dari tensor [1, 5+numClasses, 8400]
 * YOLO11 output format: [cx, cy, w, h, cls0_conf, cls1_conf, ...]
 */
function postprocess(outputData, numAnchors, numClasses, inputSize, scale, padX, padY, confThreshold) {
  const boxes = []

  for (let i = 0; i < numAnchors; i++) {
    // Setiap kolom i berisi [cx, cy, w, h, cls0_conf, cls1_conf, ...]
    const cx = outputData[0 * numAnchors + i]
    const cy = outputData[1 * numAnchors + i]
    const w  = outputData[2 * numAnchors + i]
    const h  = outputData[3 * numAnchors + i]

    let bestScore = 0
    let bestClass = 0
    for (let c = 0; c < numClasses; c++) {
      const score = outputData[(4 + c) * numAnchors + i]
      if (score > bestScore) {
        bestScore = score
        bestClass = c
      }
    }

    if (bestScore < confThreshold) continue

    // cx, cy, w, h → x, y, w, h dalam koordinat input model (640x640)
    // Kembalikan ke koordinat video asli
    const x = (cx - w / 2 - padX) / scale
    const y = (cy - h / 2 - padY) / scale
    const bw = w / scale
    const bh = h / scale

    boxes.push({
      bbox: [x, y, bw, bh],
      score: bestScore,
      class: CLASS_NAMES[bestClass] || 'person',
    })
  }

  return boxes
}

export default function useObjectDetection(videoRef, enabled) {
  const sessionRef = useRef(null)
  const intervalRef = useRef(null)
  const isInferringRef = useRef(false)
  const [detections, setDetections] = useState([])
  const [modelStatus, setModelStatus] = useState('idle')

  // Load model ONNX
  useEffect(() => {
    let cancelled = false

    async function loadModel() {
      if (sessionRef.current || !enabled) return
      setModelStatus('loading')
      try {
        console.log('[YOLO] Mengunduh model ONNX dari:', MODEL_URL)
        const response = await fetch(MODEL_URL)
        if (!response.ok) {
          throw new Error(`Gagal fetch file model ${MODEL_URL} (status: ${response.status})`)
        }
        const modelBuffer = await response.arrayBuffer()
        
        console.log('[YOLO] Menginisialisasi session ONNX Runtime...')
        const session = await ort.InferenceSession.create(modelBuffer, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        })
        sessionRef.current = session
        console.log('[YOLO] Model ONNX siap digunakan!')
        if (!cancelled) setModelStatus('ready')
      } catch (err) {
        console.error('[YOLO] Gagal load model:', err)
        if (!cancelled) setModelStatus('error')
      }
    }

    loadModel()
    return () => { cancelled = true }
  }, [enabled])

  // Jalankan inferensi secara berkala
  useEffect(() => {
    if (!enabled || !sessionRef.current || !videoRef.current) {
      setDetections([])
      return
    }

    async function detect() {
      if (isInferringRef.current) return
      const video = videoRef.current
      const session = sessionRef.current
      if (!video || !session || video.readyState < 2 || video.videoWidth === 0) return

      try {
        isInferringRef.current = true
        const { tensor, scale, padX, padY } = preprocessFrame(video, MODEL_INPUT_SIZE)

        // Nama input tensor
        const inputName = session.inputNames[0]
        const feeds = { [inputName]: tensor }
        const results = await session.run(feeds)

        // Nama output tensor
        const outputName = session.outputNames[0]
        const output = results[outputName]
        const outputData = output.data
        const [, numFeatures, numAnchors] = output.dims
        const numClasses = numFeatures - 4

        const boxes = postprocess(
          outputData, numAnchors, numClasses,
          MODEL_INPUT_SIZE, scale, padX, padY,
          CONFIDENCE_THRESHOLD
        )
        const filtered = nms(boxes, IOU_THRESHOLD)
        setDetections(filtered)
      } catch (err) {
        console.error('[YOLO] Inferensi error:', err)
      } finally {
        isInferringRef.current = false
      }
    }

    detect()
    intervalRef.current = setInterval(detect, 600)

    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [enabled, videoRef, modelStatus])

  return { detections, modelStatus }
}
