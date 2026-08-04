// lib/caspian.js
//
// Thin wrapper around caspian-sdk so the rest of the app never touches the
// client directly. Two responsibilities:
//   1. Connect the channels once per warm serverless instance (connects are
//      idempotent server-side, but there's no reason to pay the round trip
//      on every request).
//   2. Expose small, purpose-built helpers (`emailHospital`, `messagePatient`)
//      instead of leaking the raw SDK surface into route handlers.
//
// All of this is a no-op if CASPIAN_API_KEY isn't set, so local dev and
// preview deploys without the integration configured don't break.

import { CommClient } from 'caspian-sdk'

let client = null
let connectionsPromise = null

function isConfigured() {
  return !!process.env.CASPIAN_API_KEY
}

function getClient() {
  if (!client) {
    // Reads CASPIAN_API_KEY / CASPIAN_BASE_URL from process.env.
    client = new CommClient()
  }
  return client
}

// Connects email (always) and Telegram (if a bot token is set). Cached on
// the module so a warm Lambda/Vercel instance only does this once.
async function ensureConnections() {
  if (!isConfigured()) return { email: null, telegram: null }

  if (!connectionsPromise) {
    connectionsPromise = (async () => {
      const c = getClient()
      const email = await c.connectEmail({ displayName: 'PreCare GH Triage' })

      let telegram = null
      if (process.env.TELEGRAM_BOT_TOKEN) {
        telegram = await c.connectTelegram({
          botToken: process.env.TELEGRAM_BOT_TOKEN,
          displayName: 'PreCare GH Triage',
        })
      }

      return { email, telegram }
    })().catch((err) => {
      // Don't cache a rejected promise forever - let the next call retry.
      connectionsPromise = null
      throw err
    })
  }

  return connectionsPromise
}

/**
 * Cold-email a human who has never messaged the agent (hospital on-call
 * staff, a duty desk, etc). Email is the only channel here with INITIATE
 * capability, so this always works without a prior conversation.
 */
export async function emailHospital({ subject, body, to }) {
  if (!isConfigured()) {
    console.warn('[caspian] CASPIAN_API_KEY not set - skipping hospital email:', subject)
    return { sent: false, reason: 'not_configured' }
  }

  const recipient = to || process.env.HOSPITAL_ALERT_EMAIL
  if (!recipient) {
    console.warn('[caspian] HOSPITAL_ALERT_EMAIL not set - skipping hospital email:', subject)
    return { sent: false, reason: 'no_recipient' }
  }

  const { email } = await ensureConnections()
  if (!email) return { sent: false, reason: 'email_not_connected' }

  const c = getClient()
  // initiate() is plain text - no separate subject field, so we put the
  // subject on its own first line the way a lot of alerting tools do.
  const text = `${subject}\n\n${body}`
  await c.initiate(email.id, recipient, text)
  return { sent: true, channel: 'email', to: recipient }
}

/**
 * Push a message into an existing Telegram conversation. Telegram bots can't
 * cold-start a DM (no INITIATE capability) - the patient has to have
 * messaged the bot at least once, which is why the app links a
 * caspian_conversation_id to the patient record the moment they do (see
 * app/api/caspian/dispatch/route.js). If there's no linked conversation yet,
 * this is a no-op rather than an error - email is always the fallback.
 */
export async function messagePatient({ conversationId, text }) {
  if (!isConfigured() || !conversationId) {
    return { sent: false, reason: !isConfigured() ? 'not_configured' : 'no_conversation' }
  }

  await ensureConnections()
  const c = getClient()
  await c.sendMessage(conversationId, text)
  return { sent: true, channel: 'telegram' }
}

export { getClient, ensureConnections, isConfigured }