import { useEffect, useState } from 'react'

export function degreesToCardinal(deg) {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round((deg % 360) / 22.5) % 16
  return cardinals[index]
}

export function formatCoordinatesDMS(lat, lon) {
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
      return {
        label: isDay ? 'Clear Sky' : 'Clear Night',
        type: 'clear',
        icon: isDay ? 'sunny' : 'bedtime',
      }
    case 1:
    case 2:
      return {
        label: 'Partly Cloudy',
        type: 'partly_cloudy',
        icon: isDay ? 'partly_cloudy_day' : 'partly_cloudy_night',
      }
    case 3:
      return {
        label: 'Overcast',
        type: 'cloudy',
        icon: 'cloud',
      }
    case 45:
    case 48:
      return {
        label: 'Foggy',
        type: 'fog',
        icon: 'foggy',
      }
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return {
        label: 'Light Drizzle',
        type: 'rain',
        icon: 'rainy',
      }
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
    case 80:
    case 81:
    case 82:
      return {
        label: code >= 65 || code === 82 ? 'Heavy Rain' : 'Rain Showers',
        type: 'rain',
        icon: 'rainy',
      }
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return {
        label: 'Snow Showers',
        type: 'snow',
        icon: 'weather_snowy',
      }
    case 95:
    case 96:
    case 99:
      return {
        label: 'Thunderstorm',
        type: 'thunderstorm',
        icon: 'thunderstorm',
      }
    default:
      return {
        label: 'Partly Cloudy',
        type: 'partly_cloudy',
        icon: 'partly_cloudy_day',
      }
  }
}

export default function useWeather(latitude, longitude) {
  const [weather, setWeather] = useState({
    temperature: 28,
    apparentTemperature: 30,
    humidity: 72,
    precipitation: 10,
    windSpeed: 4.2,
    windSpeedKmH: 15.1,
    windDirection: 285,
    windCardinal: 'WNW',
    condition: 'Partly Cloudy',
    weatherType: 'partly_cloudy',
    isDay: 1,
    locationName: 'Locating Area...',
    dmsLocation: formatCoordinatesDMS(latitude || -6.2, longitude || 106.816666),
    satellites: 18,
    sector: 'SEC-A1',
    loading: true,
    lastUpdated: null,
  })

  useEffect(() => {
    if (!latitude || !longitude) return

    let isMounted = true

    async function fetchRealData() {
      try {
        // 1. Fetch Real Weather from Open-Meteo
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=auto`
        const weatherRes = await fetch(weatherUrl)
        
        if (!weatherRes.ok) throw new Error('Weather fetch failed')
        const weatherData = await weatherRes.json()

        // 2. Fetch Real Location Name via Reverse Geocoding
        let placeName = 'Drone Operation Zone'
        try {
          const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          const geoRes = await fetch(geoUrl)
          if (geoRes.ok) {
            const geoData = await geoRes.json()
            const city = geoData.city || geoData.locality || geoData.principalSubdivision || ''
            const country = geoData.countryName || ''
            if (city && country) {
              placeName = `${city}, ${country}`
            } else if (city) {
              placeName = city
            }
          }
        } catch {
          // Keep default placeName if geocode fails
        }

        if (!isMounted) return

        const current = weatherData.current || {}
        const temp = Math.round(current.temperature_2m ?? 28)
        const apparent = Math.round(current.apparent_temperature ?? temp)
        const hum = Math.round(current.relative_humidity_2m ?? 70)
        const precip = Math.round((current.precipitation ?? 0) * 10)
        const windMs = Number((current.wind_speed_10m ?? 4.0).toFixed(1))
        const windKm = Number((windMs * 3.6).toFixed(1))
        const windDir = Math.round(current.wind_direction_10m ?? 285)
        const cardinal = degreesToCardinal(windDir)
        const isDay = current.is_day ?? 1
        const cond = getWeatherCondition(current.weather_code ?? 2, isDay)

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
          locationName: placeName,
          dmsLocation: formatCoordinatesDMS(latitude, longitude),
          satellites: 16 + (Math.abs(Math.round(latitude * 10)) % 6),
          sector: `SEC-${String.fromCharCode(65 + (Math.abs(Math.round(latitude)) % 6))}${Math.abs(Math.round(longitude)) % 9 + 1}`,
          loading: false,
          lastUpdated: new Date().toLocaleTimeString(),
        })
      } catch (err) {
        console.warn('Real weather sync fallback:', err)
        if (!isMounted) return
        setWeather((prev) => ({
          ...prev,
          dmsLocation: formatCoordinatesDMS(latitude, longitude),
          loading: false,
        }))
      }
    }

    fetchRealData()

    // Refresh real weather data every 5 minutes
    const interval = setInterval(fetchRealData, 5 * 60 * 1000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [latitude, longitude])

  return weather
}
