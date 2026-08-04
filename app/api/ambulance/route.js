import { supabase } from '@/lib/supabase'
import { emailHospital, messagePatient } from '@/lib/caspian'
import { getTelegramConversationId } from '@/lib/patientLinks'

export async function POST(request) {
  const { patient_id, latitude, longitude, hospital_name } = await request.json()
  const eta = Math.floor(Math.random() * 10) + 5

  if (!supabase) {
    notifyDispatch({ patient_id, latitude, longitude, hospital_name, eta }).catch((err) =>
      console.error('[caspian] ambulance dispatch notification failed:', err)
    )
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

  notifyDispatch({ patient_id, latitude, longitude, hospital_name, eta }).catch((err) =>
    console.error('[caspian] ambulance dispatch notification failed:', err)
  )

  return Response.json({ request: data, eta })
}

async function notifyDispatch({ patient_id, latitude, longitude, hospital_name, eta }) {
  const mapsLink =
    latitude && longitude ? `https://maps.google.com/?q=${latitude},${longitude}` : 'location unavailable'

  await emailHospital({
    subject: `[PreCare GH] Ambulance dispatched - ETA ${eta} min`,
    body: [
      `Hospital: ${hospital_name || 'nearest available'}`,
      `Patient location: ${mapsLink}`,
      `ETA: ${eta} minutes`,
      patient_id ? `Patient ID: ${patient_id}` : 'Patient ID: not provided',
    ].join('\n'),
  })

  if (patient_id) {
    const conversationId = await getTelegramConversationId(patient_id)
    if (conversationId) {
      await messagePatient({
        conversationId,
        text: `🚑 Ambulance dispatched. ETA ${eta} minutes to ${hospital_name || 'the hospital'}. Stay where you are if possible and keep your phone nearby.`,
      })
    }
  }
}