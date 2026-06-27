import { getSupabase } from '@/lib/supabase'

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat'))
  const lon = parseFloat(searchParams.get('lon'))
  const emergency = searchParams.get('emergency') === 'true'

  let query = getSupabase().from('hospitals').select('*')
  if (emergency) query = query.eq('has_emergency', true)

  const { data, error } = await query
  if (error) return Response.json({ error }, { status: 500 })

  const hospitals = data
    .map(h => ({
      ...h,
      distance: getDistance(lat, lon, h.latitude, h.longitude),
      eta_minutes: Math.round(getDistance(lat, lon, h.latitude, h.longitude) / 0.5)
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)

  return Response.json({ hospitals })
}