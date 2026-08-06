'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const LEVEL_ORDER = { Emergency: 0, Urgent: 1, Routine: 2 }
const LEVEL_STYLE = {
  Emergency: { bg: '#F2DEDC', fg: '#A03F3A', label: 'EMERGENCY' },
  Urgent: { bg: '#F3E7D3', fg: '#A8763B', label: 'URGENT' },
  Routine: { bg: '#E3EAE1', fg: '#5F7D63', label: 'ROUTINE' },
}

export default function DashboardPage() {
  const router = useRouter()
  const [triageSessions, setTriageSessions] = useState([])
  const [ambulanceRequests, setAmbulanceRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured in this environment.')
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: sessions, error: sessionsError }, { data: ambulances }] = await Promise.all([
      supabase
        .from('triage_sessions')
        .select('*, patients(full_name, age, gender, allergies, current_medications, blood_group)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('ambulance_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (sessionsError) {
      setError(sessionsError.message)
    } else {
      setError(null)
      setTriageSessions(sessions || [])
    }
    setAmbulanceRequests(ambulances || [])
    setLastRefreshed(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // auto-refresh every 30s
    return () => clearInterval(interval)
  }, [loadData])

  const sorted = [...triageSessions].sort((a, b) => {
    const levelDiff = (LEVEL_ORDER[a.triage_level] ?? 3) - (LEVEL_ORDER[b.triage_level] ?? 3)
    if (levelDiff !== 0) return levelDiff
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const ambulanceByPatient = {}
  ambulanceRequests.forEach(a => {
    if (a.patient_id && !ambulanceByPatient[a.patient_id]) ambulanceByPatient[a.patient_id] = a
  })

  const counts = {
    Emergency: triageSessions.filter(s => s.triage_level === 'Emergency').length,
    Urgent: triageSessions.filter(s => s.triage_level === 'Urgent').length,
    Routine: triageSessions.filter(s => s.triage_level === 'Routine').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: 'var(--font-body), sans-serif' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.25rem 2rem', background: 'white', borderBottom: '1px solid #DEDACD',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => router.push('/')}>
          <div style={{ width: 32, height: 32, background: '#2F5F58', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 16, fontFamily: 'var(--font-display), serif', color: '#1F433D' }}>PreCare GH — Hospital Queue</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#4A5651' }}>
          {lastRefreshed && <span>Updated {lastRefreshed.toLocaleTimeString()}</span>}
          <button onClick={loadData} disabled={loading} style={{
            padding: '7px 16px', background: '#2F5F58', color: 'white', border: 'none',
            boerRadius: 6, fontSize: 13, fontWeight: 500, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
          }}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '2rem' }}>
          {Object.entries(counts).map(([level, count]) => (
            <div key={level} style={{
              background: LEVEL_STYLE[level].bg, borderRadius: 8, padding: '1.25rem',
              border: `1px solid ${LEVEL_STYLE[level].fg}22`,
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: LEVEL_STYLE[level].fg, fontFamily: 'var(--font-mono), monospace' }}>{count}</div>
              <div style={{ fontSize: 13, color: LEVEL_STYLE[level].fg, fontWeight: 500 }}>{level} waiting</div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: '#F2DEDC', color: '#A03F3A', padding: '1rem 1.25rem', borderRadius: 8, marginBottom: '1.5rem', fontSize: 14 }}>
            Couldn&apos;t load queue: {error}
          </div>
        )}

        {loading && sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#8A948F' }}>Loading patient queue…</div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#8A948F' }}>
            No patients in the queue yet. Submissions from the pre-check form and emergency SOS will appear here automatically.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(session => {
            const style = LEVEL_STYLE[session.triage_level] || LEVEL_STYLE.Routine
            const ambulance = session.patient_id ? ambulanceByPatient[session.patient_id] : null
            const patient = session.patients
            return (
              <div key={session.id} style={{
                background: 'white', border: '1px solid #DEDACD', borderRadius: 8,
                padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: 20,
              }}>
                <div style={{
                  background: style.bg, color: style.fg, fontSize: 11, fontWeight: 700,
                  padding: '5px 12px', borderRadius: 5, fontFamily: 'var(--font-mono), monospace',
                  letterSpacing: '0.03em', flexShrink: 0, minWidth: 90, textAlign: 'center',
                }}>{style.label}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#1B2422' }}>
                    {patient?.full_name || 'Unlinked patient'}
                    {patient?.age && <span style={{ fontWeight: 400, color: '#8A948F' }}> · {patient.age}y{patient.gender ? `, ${patient.gender}` : ''}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#4A5651', marginTop: 2 }}>{session.symptoms}</div>
                  {patient?.allergies && patient.allergies !== 'None reported' && (
                    <div style={{ fontSize: 12, color: '#A03F3A', marginTop: 4, fontWeight: 500 }}>⚠ Allergy: {patient.allergies}</div>
                  )}
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 12, color: '#8A948F' }}>
                  {session.queue_number && <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 14, fontWeight: 600, color: '#1B2422' }}>#{session.queue_number}</div>}
                  <div>{new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  {ambulance && (
                    <div style={{ marginTop: 4, color: '#2F5F58', fontWeight: 600 }}>🚑 ETA {ambulance.eta_minutes}min</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
