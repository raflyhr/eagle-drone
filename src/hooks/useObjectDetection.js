import { useEffect, useRef, useState } from 'react'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'

export default function useObjectDetection(videoRef, enabled) {
  const modelRef = useRef(null)
  const intervalRef = useRef(null)
  const [detections, setDetections] = useState([])
  const [modelStatus, setModelStatus] = useState('idle')

  useEffect(() => {
    let cancelled = false

    async function loadModel() {
      if (modelRef.current || !enabled) return
      setModelStatus('loading')
      try {
        modelRef.current = await cocoSsd.load()
        if (!cancelled) setModelStatus('ready')
      } catch {
        if (!cancelled) setModelStatus('error')
      }
    }

    loadModel()
    return () => { cancelled = true }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !modelRef.current || !videoRef.current) {
      setDetections([])
      return
    }

    async function detect() {
      const video = videoRef.current
      if (!video || video.readyState < 2 || video.videoWidth === 0) return
      try {
        const predictions = await modelRef.current.detect(video)
        setDetections(predictions.filter((item) => item.class === 'person' && item.score >= 0.5))
      } catch {
        setDetections([])
      }
    }

    detect()
    intervalRef.current = setInterval(detect, 700)

    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [enabled, videoRef, modelStatus])

  return { detections, modelStatus }
}
