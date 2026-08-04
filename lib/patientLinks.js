// lib/patientLinks.js
//
// Telegram bots can't cold-message someone (no INITIATE capability - see
// lib/caspian.js), so a patient has to message the bot at least once before
// we can push updates to them there. This tracks the resulting
// caspian conversation_id against the patient row it belongs to.
//
// Requires a `telegram_conversation_id text` column on `patients`
// (see supabase/caspian_migration.sql).

import { supabase } from '@/lib/supabase'

export async function linkTelegramConversation(patientId, conversationId) {
  if (!supabase || !patientId || !conversationId) return { linked: false }

  const { error } = await supabase
    .from('patients')
    .update({ telegram_conversation_id: conversationId })
    .eq('id', patientId)

  if (error) {
    console.error('[caspian] failed to link telegram conversation:', error)
    return { linked: false, error }
  }
  return { linked: true }
}

export async function getTelegramConversationId(patientId) {
  if (!supabase || !patientId) return null

  const { data, error } = await supabase
    .from('patients')
    .select('telegram_conversation_id')
    .eq('id', patientId)
    .single()

  if (error) return null
  return data?.telegram_conversation_id ?? null
}

export async function findPatientByTelegramConversation(conversationId) {
  if (!supabase || !conversationId) return null

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('telegram_conversation_id', conversationId)
    .single()

  if (error) return null
  return data
}