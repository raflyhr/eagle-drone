import { isSupabaseConfigured, supabase } from '../lib/supabase'

const STORAGE_BUCKET = 'mission-captures'
const TRACK_SAMPLE_INTERVAL_MS = 1500
const TRACK_MIN_DISTANCE_METERS = 5

export function getTrackWritePolicy(lastTrackAt, lastTrackPoint, nextPoint, now = Date.now()) {
  if (!Number.isFinite(nextPoint?.latitude) || !Number.isFinite(nextPoint?.longitude)) return false
  if (!lastTrackAt || !lastTrackPoint) return true
  if (now - lastTrackAt >= TRACK_SAMPLE_INTERVAL_MS) return true
  const dLat = lastTrackPoint.latitude - nextPoint.latitude
  const dLon = lastTrackPoint.longitude - nextPoint.longitude
  return Math.sqrt(dLat * dLat + dLon * dLon) > TRACK_MIN_DISTANCE_METERS / 111000
}

export async function createMissionRecord(payload) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('missions')
    .insert({
      mission_code: payload.missionCode,
      mission_type: payload.missionType,
      status: payload.status,
      started_at: payload.startedAt,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export function finalizeMissionOnUnload(missionId, payload) {
  if (!isSupabaseConfigured || !missionId) return
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  fetch(`${url}/rest/v1/missions?id=eq.${missionId}`, {
    method: 'PATCH',
    keepalive: true,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

export async function updateMissionRecord(missionId, payload) {
  if (!isSupabaseConfigured || !missionId) return
  const updates = {}
  if (payload.status) updates.status = payload.status
  if (payload.finishedAt) updates.finished_at = payload.finishedAt
  if (payload.durationSeconds !== undefined) updates.duration_seconds = payload.durationSeconds
  if (payload.distanceMeters !== undefined) updates.distance_meters = payload.distanceMeters
  if (payload.maxAltitudeMeters !== undefined) updates.max_altitude_meters = payload.maxAltitudeMeters
  if (payload.startLatitude !== undefined) updates.start_lat = payload.startLatitude
  if (payload.startLongitude !== undefined) updates.start_lng = payload.startLongitude
  if (payload.finishLatitude !== undefined) updates.finish_lat = payload.finishLatitude
  if (payload.finishLongitude !== undefined) updates.finish_lng = payload.finishLongitude
  const { error } = await supabase.from('missions').update(updates).eq('id', missionId)
  if (error) throw error
}

export async function insertTrackPoint(missionId, point) {
  if (!isSupabaseConfigured || !missionId) return
  const { error } = await supabase.from('mission_track_points').insert({
    mission_id: missionId,
    recorded_at: point.recordedAt,
    latitude: point.latitude,
    longitude: point.longitude,
    altitude_meters: point.altitudeMeters,
    speed_mps: point.speedMps,
    heading: point.heading,
    battery_percent: point.batteryPercent,
  })
  if (error) throw error
}

export async function uploadMissionCapture(missionId, capture) {
  if (!isSupabaseConfigured || !missionId || !capture.image) return null
  const base64 = capture.image.split(',')[1]
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const path = `${missionId}/${capture.id}.jpg`
  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('mission_captures')
    .insert({
      mission_id: missionId,
      storage_path: path,
      captured_at: capture.capturedAt,
      ai_detections: capture.detections || [],
    })
    .select('id, storage_path, captured_at, ai_detections')
    .single()
  if (error) throw error
  return data
}

export async function createSignedCaptureUrl(storagePath) {
  if (!isSupabaseConfigured || !storagePath) return null
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function insertMarkedLocation(missionId, location) {
  if (!isSupabaseConfigured || !missionId) return null
  const { data, error } = await supabase
    .from('mission_marked_locations')
    .insert({
      mission_id: missionId,
      capture_id: location.captureId,
      latitude: location.latitude,
      longitude: location.longitude,
      altitude_meters: location.altitudeMeters,
      marked_at: location.markedAt,
    })
    .select('id, capture_id, latitude, longitude, altitude_meters, marked_at')
    .single()
  if (error) throw error
  return data
}

export function formatMissionRecord(record) {
  return {
    id: record.mission_code,
    type: record.mission_type === 'thermal_search' ? 'Thermal Search' : record.mission_type === 'p3k_delivery' ? 'P3K Delivery' : 'Evacuation',
    date: new Date(record.started_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    duration: new Date((record.duration_seconds || 0) * 1000).toISOString().slice(11, 19),
    distance: `${((record.distance_meters || 0) / 1000).toFixed(2)} km`,
    maxAltitude: `${record.max_altitude_meters || 0} m`,
    status: record.status === 'live' ? 'Live' : 'Success',
    databaseId: record.id,
  }
}

export async function deleteMissionLogs(missionIds) {
  if (!isSupabaseConfigured || !missionIds?.length) return
  const { data: captures, error: captureError } = await supabase
    .from('mission_captures')
    .select('storage_path')
    .in('mission_id', missionIds)
  if (captureError) throw captureError
  const paths = (captures || []).map((capture) => capture.storage_path).filter(Boolean)
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(paths)
    if (storageError) throw storageError
  }
  const { error } = await supabase.from('missions').delete().in('id', missionIds).eq('status', 'success')
  if (error) throw error
}

export async function fetchMissionLogs() {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('missions')
    .select('id, mission_code, mission_type, status, started_at, finished_at, duration_seconds, distance_meters, max_altitude_meters')
    .order('started_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchMissionDetail(missionId) {
  if (!isSupabaseConfigured || !missionId) return null
  const [missionRes, trackRes, captureRes, markerRes] = await Promise.all([
    supabase.from('missions').select('*').eq('id', missionId).single(),
    supabase.from('mission_track_points').select('*').eq('mission_id', missionId).order('recorded_at', { ascending: true }),
    supabase.from('mission_captures').select('*').eq('mission_id', missionId).order('captured_at', { ascending: false }),
    supabase.from('mission_marked_locations').select('*').eq('mission_id', missionId).order('marked_at', { ascending: false }),
  ])
  if (missionRes.error) throw missionRes.error
  if (trackRes.error) throw trackRes.error
  if (captureRes.error) throw captureRes.error
  if (markerRes.error) throw markerRes.error

  const captures = await Promise.all((captureRes.data || []).map(async (capture) => ({
    id: capture.id,
    timestamp: new Date(capture.captured_at).toLocaleTimeString('en-US', { hour12: false }),
    image: await createSignedCaptureUrl(capture.storage_path),
    detections: capture.ai_detections || [],
    source: 'Camera Capture',
  })))

  return {
    mission: missionRes.data,
    trackPoints: (trackRes.data || []).map((point) => [Number(point.latitude), Number(point.longitude)]),
    captures,
    markedLocations: (markerRes.data || []).map((marker) => ({
      id: marker.id,
      captureId: marker.capture_id,
      coordinate: [Number(marker.latitude), Number(marker.longitude)],
      altitude: Number(marker.altitude_meters ?? 0),
      timestamp: new Date(marker.marked_at).toLocaleTimeString('en-US', { hour12: false }),
    })),
  }
}
