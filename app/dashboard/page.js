 'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [ambulances, setAmbulances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    const { data: s } = await supabase
      .from('triage_sessions')
      .select('*, patients(*)')
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: a } = await supabase
      .from('ambulance_requests')
      .select('*, patients(*)')
      .order('created_at', { ascending: false })
      .limit(10)

    setSessions(s || [])
    setAmbulances(a || [])
    setLoading(false)
  }

  const colors = { EMERGENCY: '#ef4444', URGENT: '#f59e0b', ROUTINE: '#22c55e' }

  return (
    <div style={{minHeight:'100vh', background:'#f8fafc', fontFamily:'Inter, sans-serif'}}>
      <nav style={{background:'#0f172a', padding:'0 2rem', height:'64px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px', color:'white', fontWeight:600, fontSize:'16px'}}>
          <div style={{width:'32px', height:'32px', background:'#1a56db', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          PreCare GH — Hospital Dashboard
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <div style={{width:'8px', height:'8px', background:'#22c55e', borderRadius:'50%'}}></div>
          <span style={{color:'#94a3b8', fontSize:'13px'}}>Live</span>
        </div>
      </nav>

      <div style={{padding:'2rem'}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'2rem'}}>
          {[
            {label:'Total patients today', value: sessions.length, color:'#1a56db'},
            {label:'Emergency', value: sessions.filter(s=>s.triage_level==='EMERGENCY').length, color:'#ef4444'},
            {label:'Urgent', value: sessions.filter(s=>s.triage_level==='URGENT').length, color:'#f59e0b'},
            {label:'Ambulances dispatched', value: ambulances.length, color:'#8b5cf6'},
          ].map(s => (
            <div key={s.label} style={{background:'white', borderRadius:'12px', padding:'1.25rem', border:'0.5px solid #e2e8f0'}}>
              <div style={{fontSize:'13px', color:'#64748b', marginBottom:'8px'}}>{s.label}</div>
              <div style={{fontSize:'32px', fontWeight:700, color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem'}}>
          <div style={{background:'white', borderRadius:'16px', border:'0.5px solid #e2e8f0', overflow:'hidden'}}>
            <div style={{padding:'1.25rem', borderBottom:'0.5px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontWeight:600, color:'#0f172a'}}>Incoming patients</div>
              <div style={{fontSize:'12px', color:'#64748b'}}>Auto-refreshes every 10s</div>
            </div>
            {loading ? (
              <div style={{padding:'2rem', textAlign:'center', color:'#94a3b8'}}>Loading...</div>
            ) : sessions.length === 0 ? (
              <div style={{padding:'2rem', textAlign:'center', color:'#94a3b8'}}>No patients yet</div>
            ) : (
              sessions.map(s => (
                <div key={s.id} style={{padding:'1rem 1.25rem', borderBottom:'0.5px solid #f1f5f9', display:'flex', alignItems:'center', gap:'12px'}}>
                  <div style={{width:'10px', height:'10px', borderRadius:'50%', background: colors[s.triage_level] || '#22c55e', flexShrink:0}}></div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600, fontSize:'14px', color:'#0f172a'}}>{s.patients?.full_name || 'Unknown'}</div>
                    <div style={{fontSize:'12px', color:'#64748b'}}>{s.symptoms}</div>
                  </div>
                  <div style={{fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'100px', background: s.triage_level==='EMERGENCY'?'#fee2e2': s.triage_level==='URGENT'?'#fef3c7':'#dcfce7', color: colors[s.triage_level]}}>
                    {s.triage_level}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{background:'white', borderRadius:'16px', border:'0.5px solid #e2e8f0', overflow:'hidden'}}>
            <div style={{padding:'1.25rem', borderBottom:'0.5px solid #e2e8f0'}}>
              <div style={{fontWeight:600, color:'#0f172a'}}>Ambulance requests</div>
            </div>
            {ambulances.length === 0 ? (
              <div style={{padding:'2rem', textAlign:'center', color:'#94a3b8'}}>No active requests</div>
            ) : (
              ambulances.map(a => (
                <div key={a.id} style={{padding:'1rem 1.25rem', borderBottom:'0.5px solid #f1f5f9'}}>
                  <div style={{fontWeight:600, fontSize:'14px', color:'#0f172a', marginBottom:'4px'}}>{a.patients?.full_name || 'Unknown'}</div>
                  <div style={{fontSize:'12px', color:'#64748b', marginBottom:'8px'}}>→ {a.hospital_assigned}</div>
                  <div style={{display:'flex', gap:'8px'}}>
                    <span style={{fontSize:'11px', background:'#eff6ff', color:'#1a56db', padding:'3px 10px', borderRadius:'100px'}}>{a.eta_minutes} min ETA</span>
                    <span style={{fontSize:'11px', background: a.status==='dispatched'?'#dcfce7':'#f1f5f9', color: a.status==='dispatched'?'#16a34a':'#475569', padding:'3px 10px', borderRadius:'100px'}}>{a.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}