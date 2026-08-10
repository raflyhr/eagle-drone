import { useEffect, useState, useCallback, useRef } from 'react'
import { resolveLocationName, getOfflineLocationName } from '../utils/geoCoder'

export function degreesToCardinal(deg) {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round((deg % 360) / 22.5) % 16
  return cardinals[index]
}

export function formatCoordinatesDMS(lat, lon) {
  if (lat === undefined || lon === undefined || lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
    return '0°00\'00"N, 0°00\'00"E'
  }
  const formatSingle = (deg, isLat) => {
    const absolute = Math.abs(deg)
    const degrees = Math.floor(absolute)
    const minutesNotTruncated = (absolute - degrees) * 60
    const minutes = Math.floor(minutesNotTruncated)
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1)
    const direction = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W')
    return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds}"${direction}`
  }
  return `${formatSingle(lat, true)}, ${formatSingle(lon, false)}`
}

function getWeatherCondition(code, isDay = 1) {
  switch (code) {
    case 0:
      return { label: isDay ? 'Clear Sky' : 'Clear Night', type: 'clear', icon: isDay ? 'sunny' : 'bedtime' }
    case 1:
    case 2:
    case 3:
      return { label: 'Partly Cloudy', type: 'partly_cloudy', icon: isDay ? 'partly_cloudy_day' : 'nights_stay' }
    case 45:
    case 48:
      return { label: 'Foggy', type: 'fog', icon: 'foggy' }
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return { label: 'Drizzle', type: 'drizzle', icon: 'grain' }
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
    case 80:
    case 81:
    case 82:
      return { label: 'Rain', type: 'rain', icon: 'rainy' }
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return { label: 'Snow', type: 'snow', icon: 'ac_unit' }
    case 95:
    case 96:
    case 99:
      return { label: 'Thunderstorm', type: 'thunderstorm', icon: 'thunderstorm' }
    default:
      return { label: 'Partly Cloudy', type: 'partly_cloudy', icon: 'partly_cloudy_day' }
  }
}

// Dynamic Reverse Geocoder via geoCoder engine
async function fetchDynamicPlaceName(lat, lon) {
  try {
    const name = await resolveLocationName(lat, lon)
    if (name && name.trim().length > 0) return name
  } catch {
    // fallback
  }
  return getOfflineLocationName(lat, lon)
}

/**
 * useWeather Hook with Direct Laptop/Dashboard Device GPS Tracking,
 * Drone GPS Sync, and High-Precision Location Resolution.
 */
export default function useWeather(droneLat, droneLon) {
  const [locationMode, setLocationMode] = useState(() => {
    try {
      return localStorage.getItem('eagle_weather_mode') || 'device'
    } catch {
      return 'device'
    }
  }) // 'device' | 'drone' | 'manual'

  const [coords, setCoords] = useState(() => {
    try {
      const saved = localStorage.getItem('eagle_weather_coords')
      if (saved) return JSON.parse(saved)
    } catch {
      // fallback
    }
    return null
  })

  const [gpsAccuracy, setGpsAccuracy] = useState(null)
  const [gpsError, setGpsError] = useState(null)

  const [weather, setWeather] = useState({
    temperature: '--',
    apparentTemperature: '--',
    humidity: '--',
    precipitation: 0,
    windSpeed: 0,
    windSpeedKmH: 0,
    windDirection: 0,
    windCardinal: 'N',
    condition: 'Loading...',
    weatherType: 'partly_cloudy',
    isDay: 1,
    locationName: 'Detecting Dashboard Location...',
    dmsLocation: '',
    loading: true,
    lastUpdated: null,
  })

  const watchIdRef = useRef(null)

  // 1. Force Device GPS Detection (Laptop Location)
  const syncWithDeviceGps = useCallback(() => {
    setLocationMode('device')
    try {
      localStorage.setItem('eagle_weather_mode', 'device')
    } catch {
      // ignore
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          customName: null,
        }
        setGpsAccuracy(pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null)
        setGpsError(null)
        setCoords(newCoords)
        try {
          localStorage.setItem('eagle_weather_coords', JSON.stringify(newCoords))
        } catch {
          // ignore
        }
      },
      async (err) => {
        console.warn('Device GPS detection notice:', err.message)
        setGpsError(err.message)
        // Fallback to IP or default drone coordinates
        if (droneLat && droneLon) {
          setCoords({ lat: droneLat, lon: droneLon, customName: null })
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )
  }, [droneLat, droneLon])

  // 2. Sync with Drone Telemetry GPS
  const syncWithDroneGps = useCallback((dLat, dLon) => {
    const lat = dLat ?? droneLat ?? -7.5950
    const lon = dLon ?? droneLon ?? 110.4485
    setLocationMode('drone')
    try {
      localStorage.setItem('eagle_weather_mode', 'drone')
    } catch {
      // ignore
    }

    const newCoords = { lat, lon, customName: null }
    setCoords(newCoords)
    try {
      localStorage.setItem('eagle_weather_coords', JSON.stringify(newCoords))
    } catch {
      // ignore
    }
  }, [droneLat, droneLon])

  // 3. Set Manual / Searched Location
  const setCustomLocation = useCallback((name, lat, lon) => {
    setLocationMode('manual')
    try {
      localStorage.setItem('eagle_weather_mode', 'manual')
    } catch {
      // ignore
    }

    const newCoords = { lat, lon, customName: name }
    setCoords(newCoords)
    try {
      localStorage.setItem('eagle_weather_coords', JSON.stringify(newCoords))
    } catch {
      // ignore
    }
  }, [])

  // Auto-detect Device GPS on initial mount and maintain live watch
  useEffect(() => {
    let isMounted = true

    if (locationMode === 'device') {
      if ('geolocation' in navigator) {
        // Instant check
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (isMounted) {
              const newCoords = {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                customName: null,
              }
              setGpsAccuracy(pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null)
              setGpsError(null)
              setCoords(newCoords)
              try {
                localStorage.setItem('eagle_weather_coords', JSON.stringify(newCoords))
              } catch {
                // ignore
              }
            }
          },
          (err) => {
            if (isMounted) {
              console.info('Initial device GPS info:', err.message)
              setGpsError(err.message)
              if (!coords) {
                const fallbackCoords = { lat: droneLat || -7.5950, lon: droneLon || 110.4485, customName: null }
                setCoords(fallbackCoords)
              }
            }
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        )

        // Continuous watch for laptop device GPS changes
        try {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              if (isMounted && locationMode === 'device') {
                const newCoords = {
                  lat: pos.coords.latitude,
                  lon: pos.coords.longitude,
                  customName: null,
                }
                setGpsAccuracy(pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null)
                setCoords(newCoords)
              }
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 10000 }
          )
        } catch {
          // ignore
        }
      } else if (!coords) {
        setCoords({ lat: droneLat || -7.5950, lon: droneLon || 110.4485, customName: null })
      }
    } else if (locationMode === 'drone') {
      if (droneLat && droneLon) {
        setCoords({ lat: droneLat, lon: droneLon, customName: null })
      }
    }

    return () => {
      isMounted = false
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [locationMode])

  // Sync with live drone coordinates when in 'drone' mode
  useEffect(() => {
    if (locationMode === 'drone' && droneLat && droneLon) {
      setCoords((prev) => {
        if (prev && Math.abs(prev.lat - droneLat) < 0.0001 && Math.abs(prev.lon - droneLon) < 0.0001) {
          return prev
        }
        return { lat: droneLat, lon: droneLon, customName: null }
      })
    }
  }, [locationMode, droneLat, droneLon])

  // Reverse-geocode coordinates & Fetch live weather dynamically
  useEffect(() => {
    if (!coords) return
    let isMounted = true
    const { lat, lon, customName } = coords

    async function updateWeatherData() {
      try {
        let placeName = customName
        if (!placeName) {
          placeName = await fetchDynamicPlaceName(lat, lon)
        }

        // Fetch live Open-Meteo Weather
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=auto`
        const weatherRes = await fetch(weatherUrl)
        
        if (!weatherRes.ok) throw new Error('Weather API error')
        const weatherData = await weatherRes.json()
        if (!isMounted) return

        const current = weatherData.current || {}
        const temp = Math.round(current.temperature_2m ?? 30)
        const apparent = Math.round(current.apparent_temperature ?? temp)
        const hum = Math.round(current.relative_humidity_2m ?? 60)
        const precip = Math.round((current.precipitation ?? 0) * 10)
        const windMs = Number((current.wind_speed_10m ?? 2.5).toFixed(1))
        const windKm = Number((windMs * 3.6).toFixed(1))
        const windDir = Math.round(current.wind_direction_10m ?? 285)
        const cardinal = degreesToCardinal(windDir)
        const isDay = current.is_day ?? 1
        const cond = getWeatherCondition(current.weather_code ?? 3, isDay)

        setWeather({
          temperature: temp,
          apparentTemperature: apparent,
          humidity: hum,
          precipitation: precip,
          windSpeed: windMs,
          windSpeedKmH: windKm,
          windDirection: windDir,
          windCardinal: cardinal,
          condition: cond.label,
          weatherType: cond.type,
          isDay,
          locationName: placeName || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          dmsLocation: formatCoordinatesDMS(lat, lon),
          lat,
          lon,
          loading: false,
          lastUpdated: new Date().toLocaleTimeString(),
        })
      } catch (err) {
        console.warn('Weather sync error:', err)
        if (!isMounted) return
        setWeather((prev) => ({
          ...prev,
          locationName: customName || prev.locationName,
          dmsLocation: formatCoordinatesDMS(lat, lon),
          lat,
          lon,
          loading: false,
          lastUpdated: new Date().toLocaleTimeString(),
        }))
      }
    }

    updateWeatherData()
    const interval = setInterval(updateWeatherData, 5 * 60 * 1000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [coords])

  return {
    ...weather,
    locationMode,
    gpsAccuracy,
    gpsError,
    syncWithDeviceGps,
    syncWithDroneGps,
    setCustomLocation,
    detectLiveLocation: syncWithDeviceGps,
  }
}
