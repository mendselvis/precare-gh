'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistance } from '@/lib/geo'

export default function HospitalsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [hospitals, setHospitals] = useState([])
  const [filteredHospitals, setFilteredHospitals] = useState([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  const [userAddress, setUserAddress] = useState('')
  const [locationError, setLocationError] = useState(false)

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const long = position.coords.longitude
          setUserLocation({ lat, long })
          
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${long}&zoom=14&addressdetails=1`
            )
            const data = await response.json()
            if (data && data.display_name) {
              const parts = data.display_name.split(',')
              setUserAddress(parts.slice(0, 3).join(',').trim())
            }
          } catch (error) {
            console.error('Error getting address:', error)
          }
          
          fetchHospitals(lat, long)
        },
        (error) => {
          console.error('Geolocation error:', error)
          setLocationError(true)
          setUserAddress('Location access denied')
          fetchHospitals(null, null)
        }
      )
    } else {
      setLocationError(true)
      setUserAddress('GPS not supported')
      fetchHospitals(null, null)
    }
  }, [])

  const fetchHospitals = async (lat, long) => {
    setLoading(true)
    try {
      const url = lat != null && long != null
        ? `/api/hospitals?lat=${lat}&lon=${long}`
        : '/api/hospitals'
      const res = await fetch(url)
      const { hospitals: data } = await res.json()
      setHospitals(data || [])
      setFilteredHospitals(data || [])
    } catch (error) {
      console.error('Error fetching hospitals:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!search.trim()) {
      setFilteredHospitals(hospitals)
      return
    }
    
    const filtered = hospitals.filter(h => 
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.location.toLowerCase().includes(search.toLowerCase()) ||
      (h.specialties && h.specialties.some(s => s.toLowerCase().includes(search.toLowerCase())))
    )
    setFilteredHospitals(filtered)
  }, [search, hospitals])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#0f172a', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: '18px', color: '#0f172a' }}>Loading hospitals...</p>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '0.5rem' }}>
            {userAddress || 'Finding hospitals near you'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '0.5rem', color: '#0f172a' }}>
          Find Hospitals Near You
        </h1>
        <p style={{ color: '#64748b' }}>
          {userLocation 
            ? `Showing hospitals near ${userAddress || 'your location'}`
            : 'Search hospitals by name, location, or specialty'}
        </p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search hospitals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 20px',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '16px',
              paddingLeft: '48px',
              outline: 'none',
              background: 'white',
              color: '#0f172a'
            }}
          />
          <span style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Showing {filteredHospitals.length} hospitals
        </p>
        {userLocation && filteredHospitals.length > 0 && (
          <span style={{ fontSize: '12px', background: '#dcfce7', color: '#16a34a', padding: '4px 12px', borderRadius: '100px' }}>
            Sorted by distance
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {filteredHospitals.map((h) => (
          <div
            key={h.id}
            style={{
              background: 'white',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              transition: 'all 0.3s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{
              height: '120px',
              background: h.has_emergency ? 'linear-gradient(135deg, #dc2626 0%, #1a56db 100%)' : 'linear-gradient(135deg, #1e3a8a 0%, #1a56db 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.9"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              {h.has_emergency && (
                <span style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: '#ef4444',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '100px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  Emergency
                </span>
              )}
              {h.distance !== null && h.distance !== undefined && (
                <span style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '12px',
                  background: 'rgba(0,0,0,0.75)',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '100px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}>
                  {formatDistance(h.distance) ?? `${typeof h.distance === 'number' ? h.distance.toFixed(1) : h.distance} km`}
                </span>
              )}
            </div>
            
            <div style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px', color: '#0f172a' }}>
                {h.name}
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                {h.location}
              </p>
              
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {h.specialties && h.specialties.slice(0, 3).map((s) => (
                  <span key={s} style={{
                    background: '#eff6ff',
                    color: '#1a56db',
                    padding: '2px 10px',
                    borderRadius: '100px',
                    fontSize: '11px',
                    fontWeight: '500'
                  }}>
                    {s}
                  </span>
                ))}
                {h.specialties && h.specialties.length > 3 && (
                  <span style={{
                    background: '#f1f5f9',
                    color: '#64748b',
                    padding: '2px 10px',
                    borderRadius: '100px',
                    fontSize: '11px'
                  }}>
                    +{h.specialties.length - 3} more
                  </span>
                )}
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '12px'
              }}>
                <div>
                  <span style={{
                    background: h.accepts_nhis ? '#f0fdf4' : '#fef3c7',
                    color: h.accepts_nhis ? '#16a34a' : '#d97706',
                    padding: '2px 10px',
                    borderRadius: '100px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {h.accepts_nhis ? 'NHIS Accepted' : 'NHIS Not Accepted'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>Queue: {h.queue_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredHospitals.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 0',
          color: '#64748b'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ marginBottom: '1rem' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <h3 style={{ color: '#0f172a' }}>No hospitals found</h3>
          <p>Try adjusting your search terms</p>
        </div>
      )}

      <button
        onClick={() => router.push('/')}
        style={{
          marginTop: '2rem',
          padding: '10px 24px',
          background: 'transparent',
          color: '#475569',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          fontSize: '14px',
          cursor: 'pointer'
        }}
      >
        ← Back to home
      </button>
    </div>
  )
}