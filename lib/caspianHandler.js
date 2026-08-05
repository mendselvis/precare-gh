// lib/caspianHandler.js
//
// The one on_message handler that answers every channel Caspian is
// connected to (right now: Telegram - email is outbound-only for us, see
// lib/caspian.js). Two jobs:
//
//   1. "/start <patient_id>" - the deep link from the web app's
//      "Get live updates on Telegram" button. Link this conversation to the
//      patient record so later triage/ambulance events can push here.
//   2. Anything else - treat it as a continuation of the triage chat, using
//      the exact same agent the web UI uses (lib/triageAgent.js), so a
//      patient can do the whole intake from Telegram if they never used the
//      web form at all.
//
// Per-conversation triage history is kept in memory only (fine for a warm
// serverless instance / hackathon demo). A production version would persist
// it in Supabase keyed by conversation_id.
//
// IMPORTANT: Caspian can redeliver the same message on retry (e.g. if a
// prior attempt errored before we finished). We dedupe by message.id so a
// redelivered message doesn't get appended to history twice - unbounded
// duplicate appends is what blew up request size earlier. History length is
// also capped as a second line of defense.

import { runTriageTurn, isUrgent } from '@/lib/triageAgent'
import { emailHospital, messagePatient } from '@/lib/caspian'
import { linkTelegramConversation, findPatientByTelegramConversation } from '@/lib/patientLinks'

const conversationHistory = new Map() // conversationId -> Anthropic-style message[]
const processedMessageIds = new Set() // message.id we've already handled
const MAX_HISTORY_MESSAGES = 12 // keep only the most recent N turns

export async function handleInboundMessage(message) {
  if (message.channel !== 'telegram') return // email is outbound-only here

  if (message.id) {
    if (processedMessageIds.has(message.id)) return // already handled - skip duplicate delivery
    processedMessageIds.add(message.id)
  }

  const text = (message.text || '').trim()

  const startMatch = text.match(/^\/start\s+(\S+)/)
  if (startMatch) {
    const patientId = startMatch[1]
    await linkTelegramConversation(patientId, message.conversationId)
    await message.reply(
      "You're linked. We'll message you here the moment there's an update on your visit - no need to keep this chat open."
    )
    return
  }

  const history = conversationHistory.get(message.conversationId) || []
  history.push({ role: 'user', content: text })
  if (history.length > MAX_HISTORY_MESSAGES) {
    history.splice(0, history.length - MAX_HISTORY_MESSAGES)
  }

  const { message: reply, triage } = await runTriageTurn(history)
  history.push({ role: 'assistant', content: reply })
  if (history.length > MAX_HISTORY_MESSAGES) {
    history.splice(0, history.length - MAX_HISTORY_MESSAGES)
  }
  conversationHistory.set(message.conversationId, history)

  await message.reply(reply)

  if (isUrgent(triage)) {
    const patient = await findPatientByTelegramConversation(message.conversationId)
    await emailHospital({
      subject: `[PreCare GH] ${triage.level} triage via Telegram: ${patient?.full_name || 'Unlinked patient'}`,
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
        '',
        patient ? `Patient ID: ${patient.id}` : 'No linked patient record - Telegram-only intake.',
      ].join('\n'),
    })
    await messagePatient({
      conversationId: message.conversationId,
      text: "We've alerted the hospital team so they're expecting you.",
    })
  }
}
