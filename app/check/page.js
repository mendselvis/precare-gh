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