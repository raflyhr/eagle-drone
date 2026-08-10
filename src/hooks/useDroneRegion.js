import { useEffect, useState, useRef } from 'react'
import { getOfflineLocationName, reverseGeocodeOnline } from '../utils/geoCoder'

// Global in-memory cache for resolved drone coordinates
const regionCache = new Map()

export default function useDroneRegion(latitude, longitude) {
  const [regionName, setRegionName] = useState(() => {
    if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
      const key = `${Number(latitude).toFixed(2)},${Number(longitude).toFixed(2)}`
      if (regionCache.has(key)) return regionCache.get(key)
      return getOfflineLocationName(latitude, longitude)
    }
    return 'UAV Base Area'
  })

  const lastFetchTime = useRef(0)
  const lastCoords = useRef({ lat: null, lon: null })
  const isFetching = useRef(false)

  useEffect(() => {
    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) return
    let isMounted = true

    const key = `${Number(latitude).toFixed(2)},${Number(longitude).toFixed(2)}`

    // Immediate offline high-precision resolution
    const offlineResolved = getOfflineLocationName(latitude, longitude)

    // Check cache first
    if (regionCache.has(key)) {
      setRegionName(regionCache.get(key))
      return
    }

    // Set offline resolved place name immediately (0ms latency, always informative)
    setRegionName(offlineResolved)

    // Rate-limiting check for background online reverse geocode
    const now = Date.now()
    const prev = lastCoords.current
    const moved =
      prev.lat === null ||
      Math.abs(prev.lat - latitude) > 0.005 ||
      Math.abs(prev.lon - longitude) > 0.005

    if (!moved && now - lastFetchTime.current < 8000) {
      return
    }

    if (isFetching.current) return
    if (now - lastFetchTime.current < 4000) return

    isFetching.current = true
    lastFetchTime.current = now
    lastCoords.current = { lat: latitude, lon: longitude }

    async function executeReverseGeocode() {
      try {
        const onlineResolved = await reverseGeocodeOnline(latitude, longitude)
        if (!isMounted) return

        if (onlineResolved && onlineResolved.trim().length > 0) {
          regionCache.set(key, onlineResolved)
          setRegionName(onlineResolved)
        } else {
          // Cache the offline result so we don't spam network
          regionCache.set(key, offlineResolved)
        }
      } catch (err) {
        console.warn('Drone region geocode error:', err)
      } finally {
        isFetching.current = false
      }
    }

    executeReverseGeocode()

    return () => {
      isMounted = false
    }
  }, [latitude, longitude])

  return regionName
}
