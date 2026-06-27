'use client'
import { useState, useEffect } from 'react'

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading] = useState(true)
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setLocation({ latitude, longitude })
        fetchHospitals(latitude, longitude)
      },
      err => {
        setError('Location access denied. Showing Accra hospitals.')
        fetchHospitals(5.5364, -0.2279)
      }
    )
  }, [])

  async function fetchHospitals(lat, lon, emergency = false) {
    setLoading(true)
    const res = await fetch(`/api/hospitals?lat=${lat}&lon=${lon}&emergency=${emergency}`)
    const data = await res.json()
    setHospitals(data.hospitals || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <span className="font-semibold text-gray-900">PreCare GH</span>
        <span className="ml-auto text-sm text-gray-400">Nearest hospitals</span>
      </nav>

      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nearby hospitals</h1>
            <p className="text-gray-500 text-sm mt-1">
              {location ? '📍 Using your live location' : '📍 Accra, Greater Accra'}
            </p>
          </div>
          <button
            onClick={() => location && fetchHospitals(location.latitude, location.longitude, true)}
            className="text-sm bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg font-medium">
            Emergency only
          </button>
        </div>

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-2"/>
                <div className="h-3 bg-gray-100 rounded w-1/3"/>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {hospitals.map((h, i) => (
              <div key={h.id} className={`bg-white rounded-2xl border p-5 ${i === 0 ? 'border-blue-200 ring-1 ring-blue-100' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {i === 0 && <div className="text-xs font-semibold text-blue-600 mb-1">⭐ Closest to you</div>}
                    <div className="font-semibold text-gray-900">{h.name}</div>
                    <div className="text-sm text-gray-400 mt-0.5">{h.location}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{h.distance.toFixed(1)} km</div>
                    <div className="text-xs text-gray-400">~{h.eta_minutes} min drive</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {h.has_emergency && (
                    <span className="bg-red-50 text-red-600 text-xs font-medium px-2 py-1 rounded-full border border-red-100">
                      🚨 Emergency
                    </span>
                  )}
                  {h.accepts_nhis && (
                    <span className="bg-green-50 text-green-600 text-xs font-medium px-2 py-1 rounded-full border border-green-100">
                      ✓ NHIS
                    </span>
                  )}
                  <span className="bg-gray-50 text-gray-500 text-xs font-medium px-2 py-1 rounded-full border">
                    ~{h.queue_count} ahead
                  </span>
                  <button className="ml-auto bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                    Pre-register →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}