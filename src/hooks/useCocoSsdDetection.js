import { useEffect, useRef, useState } from 'react'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'

const CONFIDENCE_THRESHOLD = 0.45

export default function useCocoSsdDetection(videoRef, enabled) {
  const modelRef = useRef(null)
  const intervalRef = useRef(null)
  const isInferringRef = useRef(false)
  const [detections, setDetections] = useState([])
  const [modelStatus, setModelStatus] = useState('idle')

  useEffect(() => {
    let cancelled = false

    if (!enabled) {
      setDetections([])
      return undefined
    }

    async function loadModel() {
      if (modelRef.current) return
      setModelStatus('loading')
      try {
        const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
        if (cancelled) return
        modelRef.current = model
        setModelStatus('ready')
      } catch (error) {
        console.error('[COCO-SSD] Gagal load model:', error)
        if (!cancelled) setModelStatus('error')
      }
    }

    loadModel()
    return () => { cancelled = true }
  }, [enabled])

  useEffect(() => {
    if (!enabled || modelStatus !== 'ready') {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      if (!enabled) setDetections([])
      return undefined
    }

    async function detect() {
      if (isInferringRef.current) return
      const video = videoRef.current
      const model = modelRef.current
      if (!video || !model || video.readyState < 2 || !video.videoWidth) return

      isInferringRef.current = true
      try {
        const predictions = await model.detect(video)
        setDetections(predictions
          .filter(({ score }) => score >= CONFIDENCE_THRESHOLD)
          .map(({ bbox, score, class: className }) => ({ bbox, score, class: className })))
      } catch (error) {
        console.error('[COCO-SSD] Inferensi error:', error)
      } finally {
        isInferringRef.current = false
      }
    }

    detect()
    intervalRef.current = setInterval(detect, 400)
    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [enabled, modelStatus, videoRef])

  return { detections, modelStatus }
}
