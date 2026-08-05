// lib/triageAgent.js
//
// The actual triage "brain" - one Groq call, one system prompt. Pulled out
// of app/api/triage/route.js so the Telegram channel (lib/caspianHandler.js)
// and the web chat hit the exact same logic instead of two triage agents
// silently drifting apart.
//
// Uses Groq's free, OpenAI-compatible API instead of Anthropic - no cost,
// no credit card, works fine for a hackathon demo's triage volume.

const SYSTEM_PROMPT = `You are a medical triage AI assistant for PreCare GH, a Ghana hospital pre-registration system.
Your job is to:
1. Chat naturally with the patient to understand their symptoms
2. Ask about allergies and current medications if not mentioned
3. When you have enough info, respond with a JSON block like this:

<triage>
{
  "complete": true,
  "level": "URGENT",
  "color": "yellow",
  "chief_complaint": "Fever + headache + vomiting",
  "duration": "2 days",
  "allergies": "Penicillin",
  "medications": "None",
  "summary": "24-year-old presenting with 2-day history of fever, headache and vomiting. Penicillin allergy noted.",
  "recommendation": "Visit hospital within 2 hours"
}
</triage>

Triage levels: EMERGENCY (red, life threatening), URGENT (yellow, within 2 hours), ROUTINE (green, normal queue).
Keep responses short and friendly. Speak like a caring Ghanaian health worker.
If patient writes in Twi, respond in Twi.`

const URGENT_LEVELS = new Set(['URGENT', 'EMERGENCY'])

/**
 * Run one turn of the triage conversation.
 * `messages` is the full chat history for this patient, in
 * { role: 'user' | 'assistant', content: string } format.
 * Returns { message, triage } where `triage` is null until the model has
 * gathered enough information to produce a structured result.
 */
export async function runTriageTurn(messages) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Groq API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const text = data.choices[0].message.content
  let triage = null

  const match = text.match(/<triage>([\s\S]*?)<\/triage>/)
  if (match) {
    try {
      triage = JSON.parse(match[1])
    } catch {
      // Model didn't produce valid JSON this turn - treat as still in progress.
    }
  }

  const message = text.replace(/<triage>[\s\S]*?<\/triage>/, '').trim()
  return { message, triage }
}

export function isUrgent(triage) {
  return !!triage && URGENT_LEVELS.has(triage.level)
}
