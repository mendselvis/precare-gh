import { runTriageTurn, isUrgent } from '@/lib/triageAgent'
import { emailHospital, messagePatient } from '@/lib/caspian'
import { getTelegramConversationId } from '@/lib/patientLinks'

export async function POST(request) {
  const { messages, patientInfo } = await request.json()

  const { message, triage } = await runTriageTurn(messages)

  // Fire-and-forget: don't make the patient wait on outbound notifications
  // to get their reply. Errors are logged inside the helpers themselves.
  if (isUrgent(triage)) {
    notifyOnUrgentTriage(triage, patientInfo).catch((err) =>
      console.error('[caspian] urgent triage notification failed:', err)
    )
  }

  return Response.json({ message, triage })
}

async function notifyOnUrgentTriage(triage, patientInfo) {
  const patientName = patientInfo?.fullName || patientInfo?.full_name || 'Unnamed patient'

  await emailHospital({
    subject: `[PreCare GH] ${triage.level} triage: ${patientName}`,
    body: [
      `Level: ${triage.level}`,
      `Chief complaint: ${triage.chief_complaint}`,
      `Duration: ${triage.duration}`,
      `Allergies: ${triage.allergies}`,
      `Medications: ${triage.medications}`,
      '',
      triage.summary,
      '',
      `Recommendation: ${triage.recommendation}`,
    ].join('\n'),
  })

  if (patientInfo?.patient_id) {
    const conversationId = await getTelegramConversationId(patientInfo.patient_id)
    if (conversationId) {
      await messagePatient({
        conversationId,
        text: `${triage.level === 'EMERGENCY' ? '🚨' : '⚠️'} ${triage.recommendation}\n\nWe've alerted the hospital team so they're expecting you. If your symptoms get worse, call 192 or use the SOS button.`,
      })
    }
  }
}