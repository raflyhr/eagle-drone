import { useCallback, useEffect, useRef, useState } from 'react'

export default function useCamera() {
  const videoRef = useRef(null)
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [cameraStatus, setCameraStatus] = useState('offline') // 'offline' | 'requesting' | 'connecting' | 'connected' | 'permission_denied' | 'error'
  const [permissionState, setPermissionState] = useState('prompt') // 'prompt' | 'granted' | 'denied'
  const [activeCameraSpecs, setActiveCameraSpecs] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Enumerate only REAL physical camera video devices (kind === 'videoinput')
  const scanDevices = useCallback(async (forceProbe = false) => {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.enumerateDevices) {
      return []
    }

    try {
      let allDevices = await navigator.mediaDevices.enumerateDevices()
      let videoDevices = allDevices.filter((dev) => dev.kind === 'videoinput')

      // If browser hides labels for privacy before getUserMedia, probe labels if requested or granted
      const hasEmptyLabels = videoDevices.some((dev) => !dev.label)
      if (forceProbe || hasEmptyLabels) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          tempStream.getTracks().forEach((track) => track.stop())
          setPermissionState('granted')
          allDevices = await navigator.mediaDevices.enumerateDevices()
          videoDevices = allDevices.filter((dev) => dev.kind === 'videoinput')
        } catch {
          // Permission not granted yet
        }
      }

      // Clean device list - ONLY real devices
      const cleanList = videoDevices.map((dev, index) => ({
        deviceId: dev.deviceId,
        label: dev.label || `Kamera Hardware #${index + 1}`,
        groupId: dev.groupId,
      }))

      setDevices(cleanList)

      // Set default selected device if none selected
      if (cleanList.length > 0 && (!selectedDeviceId || !cleanList.some((d) => d.deviceId === selectedDeviceId))) {
        setSelectedDeviceId(cleanList[0].deviceId)
      }

      return cleanList
    } catch (err) {
      console.warn('Gagal membaca daftar perangkat kamera:', err)
      return []
    }
  }, [selectedDeviceId])

  // Stop active video stream
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks()
      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraStatus('offline')
    setActiveCameraSpecs(null)
  }, [])

  // Start / Connect camera with specific deviceId or default
  const startCamera = useCallback(
    async (deviceIdToUse = null) => {
      const targetDeviceId = deviceIdToUse || selectedDeviceId

      setCameraStatus('connecting')
      setErrorMessage('')

      try {
        const constraints = {
          video: targetDeviceId
            ? { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        setPermissionState('granted')
        setCameraStatus('connected')

        // Capture active video track specs & update real device labels
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          const settings = videoTrack.getSettings()
          setActiveCameraSpecs({
            label: videoTrack.label || 'Kamera Aktif',
            width: settings.width || 1280,
            height: settings.height || 720,
            frameRate: settings.frameRate || 30,
            deviceId: settings.deviceId || targetDeviceId,
          })
        }

        // Re-scan devices to get full labels now that permission is granted
        await scanDevices(false)
      } catch (err) {
        console.error('Camera connection error:', err)
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionState('denied')
          setCameraStatus('permission_denied')
          setErrorMessage('Izin akses kamera ditolak oleh browser/pengguna.')
        } else {
          setCameraStatus('error')
          setErrorMessage(err.message || 'Gagal menghubungkan ke perangkat kamera.')
        }
      }
    },
    [scanDevices, selectedDeviceId]
  )

  // Switch selected active camera device
  const selectCamera = useCallback(
    async (newDeviceId) => {
      setSelectedDeviceId(newDeviceId)
      if (cameraStatus === 'connected' || cameraStatus === 'connecting') {
        stopCamera()
        await startCamera(newDeviceId)
      }
    },
    [cameraStatus, startCamera, stopCamera]
  )

  // Request explicit permission & refresh camera list
  const requestPermissionAndScan = useCallback(async () => {
    setCameraStatus('requesting')
    setErrorMessage('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      setPermissionState('granted')
      stream.getTracks().forEach((track) => track.stop())

      const list = await scanDevices(true)
      if (list.length > 0) {
        const firstId = list[0].deviceId
        setSelectedDeviceId(firstId)
        await startCamera(firstId)
      } else {
        setCameraStatus('offline')
      }
    } catch (err) {
      console.error('Permission check failed:', err)
      setPermissionState('denied')
      setCameraStatus('permission_denied')
      setErrorMessage('Akses kamera ditolak. Harap izinkan kamera pada browser Anda.')
    }
  }, [scanDevices, startCamera])

  const toggleCamera = useCallback(() => {
    if (cameraStatus === 'connected' || cameraStatus === 'connecting') {
      stopCamera()
    } else {
      if (selectedDeviceId) {
        startCamera(selectedDeviceId)
      } else {
        requestPermissionAndScan()
      }
    }
  }, [cameraStatus, requestPermissionAndScan, selectedDeviceId, startCamera, stopCamera])

  // Initial mount check permission & device scanning
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator?.permissions?.query) {
      navigator.permissions.query({ name: 'camera' }).then((result) => {
        if (result.state === 'granted') {
          setPermissionState('granted')
          scanDevices(true)
        } else {
          scanDevices(false)
        }
      }).catch(() => scanDevices(false))
    } else {
      scanDevices(false)
    }
  }, [scanDevices])

  // Monitor hardware device changes (USB camera plugged in / removed)
  useEffect(() => {
    const handleDeviceChange = () => {
      scanDevices(permissionState === 'granted')
    }

    if (typeof window !== 'undefined' && navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    }

    return () => {
      if (typeof window !== 'undefined' && navigator?.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
      }
    }
  }, [permissionState, scanDevices])

  // Cleanup on unmount
  useEffect(() => stopCamera, [stopCamera])

  return {
    videoRef,
    devices,
    selectedDeviceId,
    cameraStatus,
    permissionState,
    activeCameraSpecs,
    errorMessage,
    scanDevices: (force = true) => scanDevices(force),
    selectCamera,
    startCamera,
    stopCamera,
    toggleCamera,
    requestPermissionAndScan,
  }
}
