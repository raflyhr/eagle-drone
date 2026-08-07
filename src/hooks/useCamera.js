import { useCallback, useEffect, useRef, useState } from 'react'

export default function useCamera() {
  const videoRef = useRef(null)
  const [cameraStatus, setCameraStatus] = useState('offline')

  const stopCamera = useCallback(() => {
    videoRef.current?.srcObject?.getTracks().forEach((track) => track.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraStatus('offline')
  }, [])

  const startCamera = useCallback(async () => {
    setCameraStatus('connecting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraStatus('connected')
    } catch {
      setCameraStatus('error')
    }
  }, [])

  const toggleCamera = useCallback(() => {
    if (cameraStatus === 'connected' || cameraStatus === 'connecting') {
      stopCamera()
      return
    }
    startCamera()
  }, [cameraStatus, startCamera, stopCamera])

  useEffect(() => stopCamera, [stopCamera])

  return { videoRef, cameraStatus, startCamera, stopCamera, toggleCamera }
}
