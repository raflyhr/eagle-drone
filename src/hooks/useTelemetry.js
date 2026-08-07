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
    const intervalId = setInterval(() => {
      setTelemetry((value) => ({
        latitude: Number((value.latitude + 0.00018).toFixed(6)),
        longitude: Number((value.longitude + 0.00012).toFixed(6)),
        altitude: 118 + ((value.altitude + 3) % 8),
        speed: 14 + ((value.speed + 1) % 6),
        heading: (value.heading + 7) % 360,
        battery: value.battery <= 20 ? 74 : Number((value.battery - 0.2).toFixed(1)),
        signal: 96 + ((value.signal + 1) % 3),
      }))
    }, 1500)

    return () => clearInterval(intervalId)
  }, [])

  return telemetry
}
