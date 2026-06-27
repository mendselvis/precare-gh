'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

export default function CheckPage() {
  const router = useRouter()
  const [step, setStep] = useState('info') // info → chat → result
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [triage, setTriage] = useState(null)
  const [patientInfo, setPatientInfo] = useState({
    full_name: '', age: '', gender: '', nhis_number: '',
    blood_group: '', allergies: '', current_medications: '', emergency_contact: ''
  })

  async function savePatient() {
    if (!patientInfo.full_name) return alert('Please enter your name')
    const { data, error } = await getSupabase().from('patients').insert(patientInfo).select().single()
    if (error) return alert('Error saving info')
    localStorage.setItem('patient_id', data.id)
    localStorage.setItem('patient_name', data.full_name)
    setStep('chat')
    setMessages([{ role: 'assistant', content: `Hello ${data.full_name}! 👋 I'm your PreCare assistant. Please describe how you're feeling today.` }])
  }

  async function sendMessage() {
    if (!input.trim()) return
    const newMessages = [...messages, { role: 'user', content: input }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const res = await fetch('/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) })
    })
    const data = await res.json()
    setMessages([...newMessages, { role: 'assistant', content: data.message }])

    if (data.triage?.complete) {
      setTriage(data.triage)
      const patientId = localStorage.getItem('patient_id')
      await getSupabase().from('triage_sessions').insert({
        patient_id: patientId,
        symptoms: data.triage.chief_complaint,
        triage_level: data.triage.level,
        summary: data.triage.summary,
        queue_number: Math.floor(Math.random() * 50) + 1
      })
      setStep('result')
    }
    setLoading(false)
  }

  const triageColors = {
    EMERGENCY: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50', border: 'border-red-200' },
    URGENT: { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50', border: 'border-yellow-200' },
    ROUTINE: { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50', border: 'border-green-200' }
  }

  const colors = triage ? triageColors[triage.level] : triageColors.ROUTINE

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <span className="font-semibold text-gray-900">PreCare GH</span>
      </nav>

      <div className="max-w-2xl mx-auto p-6">

        {step === 'info' && (
          <div className="bg-white rounded-2xl border p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Your health profile</h1>
            <p className="text-gray-500 mb-6">This helps doctors know you before you arrive.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Full name *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Kofi Mensah"
                  value={patientInfo.full_name} onChange={e => setPatientInfo({...patientInfo, full_name: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Age</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="24" type="number"
                  value={patientInfo.age} onChange={e => setPatientInfo({...patientInfo, age: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Gender</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={patientInfo.gender} onChange={e => setPatientInfo({...patientInfo, gender: e.target.value})}>
                  <option value="">Select</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">NHIS Number</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="GHA-0023-2024"
                  value={patientInfo.nhis_number} onChange={e => setPatientInfo({...patientInfo, nhis_number: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Blood group</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={patientInfo.blood_group} onChange={e => setPatientInfo({...patientInfo, blood_group: e.target.value})}>
                  <option value="">Select</option>
                  <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                  <option>O+</option><option>O-</option><option>AB+</option><option>AB-</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Known allergies</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Penicillin, None"
                  value={patientInfo.allergies} onChange={e => setPatientInfo({...patientInfo, allergies: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Current medications</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. None"
                  value={patientInfo.current_medications} onChange={e => setPatientInfo({...patientInfo, current_medications: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Emergency contact</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="+233 24 000 0000"
                  value={patientInfo.emergency_contact} onChange={e => setPatientInfo({...patientInfo, emergency_contact: e.target.value})} />
              </div>
            </div>
            <button onClick={savePatient} className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm">
              Continue to symptom check →
            </button>
          </div>
        )}

        {step === 'chat' && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="p-4 border-b bg-blue-600">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">PreCare AI</div>
                  <div className="text-blue-200 text-xs">Describe your symptoms in English or Twi</div>
                </div>
              </div>
            </div>
            <div className="h-96 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-2">
              <input className="flex-1 border rounded-xl px-4 py-2 text-sm" placeholder="Type your symptoms..."
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()} />
              <button onClick={sendMessage} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium">Send</button>
            </div>
          </div>
        )}

        {step === 'result' && triage && (
          <div className="space-y-4">
            <div className={`rounded-2xl border-2 p-6 ${colors.light} ${colors.border}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div>
                  <div className={`text-2xl font-black ${colors.text}`}>{triage.level}</div>
                  <div className="text-gray-500 text-sm">{triage.recommendation}</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Chief complaint</span><span className="font-medium">{triage.chief_complaint}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-medium">{triage.duration}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Allergies</span><span className="font-medium text-red-600">{triage.allergies}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Medications</span><span className="font-medium">{triage.medications}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => router.push('/hospitals')}
                className="bg-white border rounded-xl p-4 text-left hover:border-blue-300">
                <div className="text-blue-600 font-semibold text-sm mb-1">🏥 Find nearest hospital</div>
                <div className="text-gray-400 text-xs">GPS-powered search</div>
              </button>
              <button onClick={() => router.push('/emergency')}
                className="bg-red-50 border border-red-200 rounded-xl p-4 text-left hover:border-red-400">
                <div className="text-red-600 font-semibold text-sm mb-1">🚑 Request ambulance</div>
                <div className="text-gray-400 text-xs">Emergency dispatch</div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}