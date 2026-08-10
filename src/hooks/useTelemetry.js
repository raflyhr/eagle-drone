import { useEffect, useState } from 'react'

export default function useTelemetry() {
  const [telemetry, setTelemetry] = useState({
    latitude: -6.2,
    longitude: 106.816666,
    altitude: 120,
    speed: 15,
    heading: 285,
    battery: 74,
    signal: 98,
  })

  useEffect(() => {
    // Attempt real browser geolocation
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setTelemetry((prev) => ({
            ...prev,
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
          }))
        },
        () => {
          // Keep default if permission denied or unavailable
        },
        { timeout: 8000 }
      )
    }

    const intervalId = setInterval(() => {
      setTelemetry((value) => ({
        latitude: Number((value.latitude + 0.00008).toFixed(6)),
        longitude: Number((value.longitude + 0.00006).toFixed(6)),
        altitude: 118 + ((value.altitude + 3) % 8),
        speed: 14 + ((value.speed + 1) % 6),
        heading: (value.heading + 5) % 360,
        battery: value.battery <= 20 ? 74 : Number((value.battery - 0.1).toFixed(1)),
        signal: 96 + ((value.signal + 1) % 3),
      }))
    }, 2000)

    return () => clearInterval(intervalId)
  }, [])

  return telemetry
}
