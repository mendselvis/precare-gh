import crypto from 'crypto'
import { supabase } from '@/lib/supabase'
import { getClient, ensureConnections, isConfigured } from '@/lib/caspian'
import { handleInboundMessage } from '@/lib/caspianHandler'

// Caspian doesn't push the full event body we need to act on in the webhook
// payload itself - it POSTs as a "something happened, come look" signal.
// We verify that signal is genuinely from Caspian, then drain whatever's
// pending via dispatchPending(), which does the actual fetch + parse +
// dispatch-to-onMessage through the SDK's own (tested) code path rather than
// us hand-parsing event JSON here.

let handlerRegistered = false

function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.CASPIAN_WEBHOOK_SECRET
  if (!secret) return true // no secret configured - skip verification (local/dev only)
  if (!signatureHeader) return false

  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function getLastSeq() {
  if (!supabase) return 0
  const { data } = await supabase.from('caspian_state').select('last_seq').eq('id', 1).single()
  return data?.last_seq ?? 0
}

async function setLastSeq(seq) {
  if (!supabase) return
  await supabase.from('caspian_state').upsert({ id: 1, last_seq: seq })
}

export async function POST(request) {
  if (!isConfigured()) {
    return Response.json({ error: 'Caspian not configured' }, { status: 503 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-caspian-signature')

  if (!verifySignature(rawBody, signature)) {
    return Response.json({ error: 'invalid signature' }, { status: 401 })
  }

  await ensureConnections()
  const client = getClient()

  if (!handlerRegistered) {
    client.onMessage(handleInboundMessage)
    handlerRegistered = true
  }

  const afterSeq = await getLastSeq()
  const newSeq = await client.dispatchPending(afterSeq)
  if (newSeq !== afterSeq) await setLastSeq(newSeq)

  return Response.json({ ok: true, processed_through: newSeq })
}
