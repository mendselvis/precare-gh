import { supabase } from '@/lib/supabase'

export async function POST(request) {
  const { patient_id, latitude, longitude, hospital_name } = await request.json()
  const eta = Math.floor(Math.random() * 10) + 5

  if (!supabase) {
    return Response.json({ request: { id: 'demo', status: 'dispatched' }, eta })
  }

  const { data, error } = await supabase
    .from('ambulance_requests')
    .insert({
      patient_id,
      latitude,
      longitude,
      status: 'dispatched',
      hospital_assigned: hospital_name,
      eta_minutes: eta,
    })
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 500 })

  return Response.json({ request: data, eta })
}
