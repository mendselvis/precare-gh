import { supabase } from '@/lib/supabase'

export async function POST(request) {
  const body = await request.json()
  const {
    full_name,
    phone,
    hospital_id,
    hospital_name,
    preferred_date,
    preferred_time,
    appointment_type,
    notes,
    latitude,
    longitude,
    patient_id,
  } = body

  if (!full_name?.trim() || !phone?.trim() || !preferred_date || !preferred_time) {
    return Response.json({ error: 'Name, phone, date and time are required' }, { status: 400 })
  }

  const record = {
    full_name: full_name.trim(),
    phone: phone.trim(),
    hospital_id: hospital_id || null,
    hospital_name: hospital_name || null,
    preferred_date,
    preferred_time,
    appointment_type: appointment_type || 'in-person',
    notes: notes?.trim() || null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    patient_id: patient_id || null,
    status: 'pending',
  }

  if (!supabase) {
    return Response.json({
      appointment: { id: `local-${Date.now()}`, ...record },
      saved: false,
    })
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert(record)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ appointment: data, saved: true })
}
