import Anthropic from '@anthropic-ai/sdk'

export async function POST(request) {
  const { messages, patientInfo } = await request.json()

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a medical triage AI assistant for PreCare GH, a Ghana hospital pre-registration system.
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
If patient writes in Twi, respond in Twi.`,
    messages: messages
  })

  const text = response.content[0].text
  let triageData = null

  const match = text.match(/<triage>([\s\S]*?)<\/triage>/)
  if (match) {
    try {
      triageData = JSON.parse(match[1])
    } catch (e) {}
  }

  const cleanText = text.replace(/<triage>[\s\S]*?<\/triage>/, '').trim()

  return Response.json({ message: cleanText, triage: triageData })
}