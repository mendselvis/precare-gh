'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CheckPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    gender: '',
    nhisNumber: '',
    bloodGroup: '',
    allergies: '',
    currentMedications: '',
    emergencyContact: '',
    symptoms: ''
  })
  const [triageResult, setTriageResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

const handleSubmit = async (e) => {
  e.preventDefault()
  setLoading(true)

  // Local keyword classification stays as a fallback - used if the AI
  // triage call fails, or if the model wants a follow-up turn instead of
  // completing on the single message this form sends.
  const symptomsLower = formData.symptoms.toLowerCase()
  let triageLevel = 'Routine'
  let summary = 'Non-urgent. You can visit the OPD during regular hours.'

  if (symptomsLower.includes('chest pain') || symptomsLower.includes('difficulty breathing') ||
      symptomsLower.includes('unconscious') || symptomsLower.includes('severe bleeding') ||
      symptomsLower.includes('stroke')) {
    triageLevel = 'Emergency'
    summary = 'EMERGENCY — call 192 or use SOS immediately.'
  } else if (symptomsLower.includes('fever') || symptomsLower.includes('vomiting') ||
             symptomsLower.includes('severe pain') || symptomsLower.includes('headache') ||
             symptomsLower.includes('injury')) {
    triageLevel = 'Urgent'
    summary = 'Urgent care needed. Visit the hospital within 2 hours.'
  }

  let patientId = null

  if (supabase) {
    try {
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert([
          {
            full_name: formData.fullName,
            age: parseInt(formData.age),
            gender: formData.gender,
            nhis_number: formData.nhisNumber || null,
            blood_group: formData.bloodGroup || null,
            allergies: formData.allergies || 'None reported',
            current_medications: formData.currentMedications || 'None reported',
            emergency_contact: formData.emergencyContact || null
          }
        ])
        .select()

      if (patientError) {
        console.error('Error saving patient:', patientError)
        alert('Error saving patient data. Please try again.')
        setLoading(false)
        return
      }

      patientId = patientData[0].id
      localStorage.setItem('patient_id', patientId)
      localStorage.setItem('patient_name', formData.fullName)
    } catch (error) {
      console.error('Supabase error:', error)
      alert('Error saving data. Please try again.')
      setLoading(false)
      return
    }
  }

  // Run the actual AI triage agent (this is the route wired to Caspian -
  // it emails the hospital and pushes a Telegram update on URGENT/EMERGENCY).
  // Everything the form already collected goes in as one message so the
  // model has what it needs to complete triage in a single turn.
  try {
    const res = await fetch('/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: `Patient: ${formData.fullName}, ${formData.age}yo, ${formData.gender}.
Allergies: ${formData.allergies || 'None reported'}
Current medications: ${formData.currentMedications || 'None reported'}
Symptoms: ${formData.symptoms}`
        }],
        patientInfo: { patient_id: patientId, fullName: formData.fullName }
      })
    })
    const aiResult = await res.json()

    if (aiResult.triage) {
      const levelMap = { EMERGENCY: 'Emergency', URGENT: 'Urgent', ROUTINE: 'Routine' }
      triageLevel = levelMap[aiResult.triage.level] || triageLevel
      summary = aiResult.triage.recommendation || aiResult.message || summary
    }
    // If aiResult.triage is null, the model wanted another turn - fall back
    // to the local keyword classification computed above rather than block
    // the flow on a single-shot form.
  } catch (error) {
    console.error('AI triage call failed, using local classification:', error)
  }

  if (supabase && patientId) {
    const { data: triageData, error: triageError } = await supabase
      .from('triage_sessions')
      .insert([
        {
          patient_id: patientId,
          symptoms: formData.symptoms,
          triage_level: triageLevel,
          summary: summary,
          queue_number: Math.floor(Math.random() * 50) + 1
        }
      ])
      .select()

    if (triageError) {
      console.error('Error saving triage:', triageError)
    }

    setTriageResult({
      triage: triageLevel,
      message: summary,
      queueNumber: triageData?.[0]?.queue_number || Math.floor(Math.random() * 30) + 1,
      patientId
    })
  } else {
    setTriageResult({
      triage: triageLevel,
      message: summary,
      queueNumber: 'N/A'
    })
  }

  setLoading(false)
  setStep(3)
}
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f8fafc',
      padding: '2rem 1rem'
    }}>
      <div style={{ 
        maxWidth: '700px', 
        margin: '0 auto', 
        padding: '2rem 1.5rem',
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
      }}>
        {/* Progress Bar */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '14px', color: step === 1 ? '#1a56db' : '#94a3b8' }}>
              Step 1: Personal Info
            </span>
            <span style={{ fontSize: '14px', color: step === 2 ? '#1a56db' : '#94a3b8' }}>
              Step 2: Symptoms
            </span>
            <span style={{ fontSize: '14px', color: step === 3 ? '#1a56db' : '#94a3b8' }}>
              Step 3: Results
            </span>
          </div>
          <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: step === 1 ? '33%' : step === 2 ? '66%' : '100%',
              background: '#1a56db',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>

        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '0.5rem', color: '#0f172a' }}>
              Your Information
            </h1>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Fill in your details so the hospital knows who you are.
            </p>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', color: '#0f172a' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g., Abena Kyerewaa"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    background: 'white',
                    color: '#0f172a'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', color: '#0f172a' }}>
                    Age *
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleChange}
                    placeholder="e.g., 45"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '16px',
                      background: 'white',
                      color: '#0f172a'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', color: '#0f172a' }}>
                    Gender *
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '16px',
                      background: 'white',
                      color: '#0f172a'
                    }}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', color: '#0f172a' }}>
                  NHIS Number (optional)
                </label>
                <input
                  type="text"
                  name="nhisNumber"
                  value={formData.nhisNumber}
                  onChange={handleChange}
                  placeholder="e.g., GH-123-456-789"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    background: 'white',
                    color: '#0f172a'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', color: '#0f172a' }}>
                  Blood Group (optional)
                </label>
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    background: 'white',
                    color: '#0f172a'
                  }}
                >
                  <option value="">Select blood group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', color: '#0f172a' }}>
                  Allergies (optional)
                </label>
                <input
                  type="text"
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleChange}
                  placeholder="e.g., Penicillin, peanuts"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    background: 'white',
                    color: '#0f172a'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', color: '#0f172a' }}>
                  Current Medications (optional)
                </label>
                <input
                  type="text"
                  name="currentMedications"
                  value={formData.currentMedications}
                  onChange={handleChange}
                  placeholder="e.g., Amlodipine 10mg daily"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    background: 'white',
                    color: '#0f172a'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', color: '#0f172a' }}>
                  Emergency Contact (optional)
                </label>
                <input
                  type="text"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  placeholder="e.g., 024-123-4567 (Kofi)"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    background: 'white',
                    color: '#0f172a'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => {
                  const required = ['fullName', 'age', 'gender']
                  if (required.every(f => formData[f])) {
                    setStep(2)
                  } else {
                    alert('Please fill in all required fields (*)')
                  }
                }}
                style={{
                  padding: '12px 32px',
                  background: '#1a56db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Next →
              </button>
              <button
                onClick={() => router.push('/emergency')}
                style={{
                  padding: '12px 32px',
                background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Emergency SOS
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Symptoms */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '0.5rem', color: '#0f172a' }}>
              What&apos;s bothering you?
            </h1>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Describe your symptoms in your own words. AI will analyze them.
            </p>
            
            <textarea
              name="symptoms"
              value={formData.symptoms}
              onChange={handleChange}
              placeholder="e.g., I have a severe headache and fever. I've been vomiting since this morning..."
              rows={6}
              required
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '16px',
                fontFamily: 'inherit',
                resize: 'vertical',
                background: 'white',
                color: '#0f172a'
              }}
            />
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  padding: '12px 32px',
                  background: 'transparent',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.symptoms.trim() || loading}
                style={{
                  padding: '12px 32px',
                  background: formData.symptoms.trim() && !loading ? '#1a56db' : '#94a3b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: formData.symptoms.trim() && !loading ? 'pointer' : 'not-allowed'
                }}
              >
                {loading ? 'Analyzing...' : 'Get Triage →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && triageResult && (
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '0.5rem', color: '#0f172a' }}>
              Triage complete
            </h1>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Here&apos;s your assessment. The hospital has been notified.
            </p>

            <div style={{
              background: triageResult.triage === 'Emergency' ? '#fee2e2' : 
                         triageResult.triage === 'Urgent' ? '#fef3c7' : '#f0fdf4',
              padding: '2rem',
              borderRadius: '16px',
              border: `3px solid ${
                triageResult.triage === 'Emergency' ? '#ef4444' : 
                triageResult.triage === 'Urgent' ? '#d97706' : '#16a34a'
              }`,
              marginBottom: '1.5rem'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                <span style={{
                  display: 'inline-block', padding: '6px 16px', borderRadius: 100, fontSize: 13, fontWeight: 700,
                  background: triageResult.triage === 'Emergency' ? '#ef4444' : triageResult.triage === 'Urgent' ? '#d97706' : '#16a34a',
                  color: 'white',
                }}>{triageResult.triage}</span>
              </div>
              <h2 style={{ 
                fontSize: '32px', 
                fontWeight: '700', 
                textAlign: 'center',
                color: triageResult.triage === 'Emergency' ? '#ef4444' : 
                       triageResult.triage === 'Urgent' ? '#d97706' : '#16a34a'
              }}>
                {triageResult.triage}
              </h2>
              <p style={{ textAlign: 'center', fontSize: '18px', marginTop: '0.5rem', color: '#0f172a' }}>
                {triageResult.message}
              </p>
              {triageResult.queueNumber && (
                <p style={{ textAlign: 'center', fontSize: '16px', marginTop: '1rem', fontWeight: '600', color: '#0f172a' }}>
                  Queue number: #{triageResult.queueNumber}
                </p>
              )}
            </div>

            {triageResult.patientId && process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && (
              <a
                href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${triageResult.patientId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  background: '#229ED9',
                  color: 'white',
                  fontWeight: 600,
                  padding: '0.9rem',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  marginBottom: '1.5rem'
                }}
              >
                Get live updates on Telegram
              </a>
            )}

            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.75rem', color: '#0f172a' }}>Patient Summary</h3>
              <div style={{ display: 'grid', gap: '0.5rem', color: '#0f172a' }}>
                <p><strong>Name:</strong> {formData.fullName}</p>
                <p><strong>Age:</strong> {formData.age}</p>
                <p><strong>Gender:</strong> {formData.gender}</p>
                {formData.nhisNumber && <p><strong>NHIS:</strong> {formData.nhisNumber}</p>}
                {formData.bloodGroup && <p><strong>Blood Group:</strong> {formData.bloodGroup}</p>}
                {formData.allergies && <p><strong>Allergies:</strong> {formData.allergies}</p>}
                {formData.currentMedications && <p><strong>Medications:</strong> {formData.currentMedications}</p>}
                {formData.emergencyContact && <p><strong>Emergency Contact:</strong> {formData.emergencyContact}</p>}
                <p><strong>Symptoms:</strong> {formData.symptoms}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/hospitals')}
                style={{
                  padding: '12px 32px',
                  background: '#1a56db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Find Nearest Hospital →
              </button>
              <button
                onClick={() => {
                  setStep(1)
                  setFormData({ 
                    fullName: '', age: '', gender: '', nhisNumber: '', 
                    bloodGroup: '', allergies: '', currentMedications: '', 
                    emergencyContact: '', symptoms: '' 
                  })
                  setTriageResult(null)
                }}
                style={{
                  padding: '12px 32px',
                  background: 'transparent',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Start New Check
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
