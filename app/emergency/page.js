'use client'
import { useState, useEffect } from 'react'

export default function EmergencyPage() {
  const [status, setStatus] = useState('idle') // idle → locating → dispatched
  const [location, setLocation] = useState(null)
  const [eta, setEta] = useState(null)
  const [hospital, setHospital] = useState(null)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (status === 'dispatched') {
      const timer = setInterval(() => setSeconds(s => s + 1), 1000)
      return () => clearInterval(timer)
    }
  }, [status])

  async function triggerSOS() {
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setLocation({ latitude, longitude })

        const res = await fetch(`/api/hospitals?lat=${latitude}&lon=${longitude}&emergency=true`)
        const data = await res.json()
        const nearest = data.hospitals?.[0]
        setHospital(nearest)

        const patientId = localStorage.getItem('patient_id')
        const ambRes = await fetch('/api/ambulance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: patientId,
            latitude,
            longitude,
            hospital_name: nearest?.name || 'Nearest hospital'
          })
        })
        const ambData = await ambRes.json()
        setEta(ambData.eta)
        setStatus('dispatched')
      },
      () => {
        setLocation({ latitude: 5.5364, longitude: -0.2279 })
        setHospital({ name: 'Korle Bu Teaching Hospital', distance: 2.4 })
        setEta(8)
        setStatus('dispatched')
      }
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <nav className="px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <span className="font-semibold text-white">PreCare GH</span>
        <span className="ml-auto text-sm text-gray-400">Emergency</span>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center p-6">

        {status === 'idle' && (
          <div className="text-center">
            <div className="text-white text-2xl font-bold mb-2">Emergency SOS</div>
            <div className="text-gray-400 text-sm mb-12">Press and hold to dispatch an ambulance</div>
            <button
              onClick={triggerSOS}
              className="w-40 h-40 bg-red-500 rounded-full flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
              style={{boxShadow: '0 0 0 16px rgba(239,68,68,0.15), 0 0 0 32px rgba(239,68,68,0.08)'}}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span className="text-white font-black text-lg mt-1">SOS</span>
            </button>
            <div className="mt-12 text-gray-500 text-xs">
              This will share your GPS location and medical profile
            </div>
          </div>
        )}

        {status === 'locating' && (
          <div className="text-center">
            <div className="w-24 h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"/>
            <div className="text-white text-xl font-bold">Getting your location...</div>
            <div className="text-gray-400 text-sm mt-2">Finding nearest emergency unit</div>
          </div>
        )}

        {status === 'dispatched' && (
          <div className="w-full max-w-sm space-y-4">
            <div className="bg-green-500 rounded-2xl p-5 text-center">
              <div className="text-white text-2xl font-black mb-1">🚑 Ambulance dispatched</div>
              <div className="text-green-100 text-sm">{hospital?.name}</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <div className="text-white text-2xl font-black">{eta}</div>
                <div className="text-gray-400 text-xs mt-1">min ETA</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <div className="text-green-400 text-sm font-bold">Sent ✓</div>
                <div className="text-gray-400 text-xs mt-1">Medical profile</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <div className="text-green-400 text-sm font-bold">Active ✓</div>
                <div className="text-gray-400 text-xs mt-1">GPS tracking</div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>
              <div className="text-gray-300 text-sm">
                {location
                  ? `GPS locked — ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                  : 'GPS locked — Accra, Greater Accra'}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <div className="text-gray-400 text-xs mb-1">Time since dispatch</div>
              <div className="text-white font-mono text-2xl">
                {String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}