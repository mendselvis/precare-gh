'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistance, estimateEtaMinutes } from '@/lib/geo'

const PRIMARY = '#1a56db'
const SLATE = '#1e293b'
const HERO_IMAGE = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1600&q=80'

const NAV_LEFT = [
  { label: 'Home', href: '/' },
  { label: 'Pre-Check', href: '/check' },
  { label: 'Hospitals', href: '/hospitals' },
  { label: 'Dashboard', href: '/dashboard' },
]

const NAV_RIGHT = [
  { label: 'Patient Info', href: '/check' },
  { label: 'Find Hospital', href: '/hospitals' },
  { label: 'Staff Login', href: '/dashboard' },
  { label: 'Contact', href: '/' },
]

function Icon({ d, size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  })
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    if (data?.display_name) {
      return data.display_name.split(',').slice(0, 3).join(',').trim()
    }
  } catch {
    /* fall through */
  }
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

export default function EmergencyPage() {
  const router = useRouter()
  const [phase, setPhase] = useState('idle') // idle | countdown | dispatched
  const [countdown, setCountdown] = useState(null)
  const [loading, setLoading] = useState(true)
  const [locationError, setLocationError] = useState(null)
  const [coords, setCoords] = useState(null)
  const [address, setAddress] = useState('')
  const [hospitals, setHospitals] = useState([])
  const [nearest, setNearest] = useState(null)
  const [eta, setEta] = useState(null)
  const [booking, setBooking] = useState({
    full_name: '',
    phone: '',
    preferred_date: '',
    preferred_time: '',
    appointment_type: 'video',
    notes: '',
  })
  const [bookingStatus, setBookingStatus] = useState(null) // null | loading | success | error
  const [bookingMessage, setBookingMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setLocationError(null)
    try {
      const pos = await getPosition()
      setCoords(pos)
      const addr = await reverseGeocode(pos.lat, pos.lon)
      setAddress(addr)

      const res = await fetch(`/api/hospitals?lat=${pos.lat}&lon=${pos.lon}&emergency=true`)
      const json = await res.json()
      const list = json.hospitals || []
      setHospitals(list)

      const closest = list.find(h => h.distance != null) || list[0] || null
      setNearest(closest)
      setEta(closest?.eta_minutes ?? estimateEtaMinutes(closest?.distance))
    } catch (err) {
      setLocationError(err.message || 'Unable to access your location')
      setHospitals([])
      setNearest(null)
      setEta(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const savedName = typeof window !== 'undefined' ? localStorage.getItem('patient_name') : null
    if (savedName) {
      setBooking(b => ({ ...b, full_name: savedName }))
    }
    loadData()
  }, [loadData])

  const dispatchSOS = async () => {
    setPhase('countdown')
    setCountdown(5)

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setPhase('dispatched')
          confirmDispatch()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  const confirmDispatch = async () => {
    try {
      await fetch('/api/ambulance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: localStorage.getItem('patient_id') || null,
          latitude: coords?.lat,
          longitude: coords?.lon,
          hospital_name: nearest?.name,
        }),
      })
    } catch (err) {
      console.error('Ambulance dispatch error:', err)
    }
  }

  const handleBooking = async (e) => {
    e.preventDefault()
    if (!nearest) {
      setBookingStatus('error')
      setBookingMessage('Enable GPS and wait for the nearest hospital to load before booking.')
      return
    }
    setBookingStatus('loading')
    setBookingMessage('')
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...booking,
          hospital_id: nearest.id,
          hospital_name: nearest.name,
          latitude: coords?.lat,
          longitude: coords?.lon,
          patient_id: localStorage.getItem('patient_id') || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Booking failed')
      setBookingStatus('success')
      setBookingMessage(
        data.saved
          ? `Appointment requested at ${nearest.name} on ${booking.preferred_date} at ${booking.preferred_time}.`
          : `Appointment saved locally. Connect Supabase to persist bookings.`
      )
    } catch (err) {
      setBookingStatus('error')
      setBookingMessage(err.message)
    }
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div style={{ minHeight: '100vh', position: 'relative', color: 'white', overflow: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .em-nav a:hover { opacity: 0.75; }
        .em-card { animation: fadeUp 0.5s ease both; }
        .em-booking input, .em-booking select, .em-booking textarea {
          width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.25);
          border-radius: 6px; background: rgba(255,255,255,0.1); color: white; font-size: 14px;
          color-scheme: dark;
        }
        .em-booking select option { background: ${SLATE}; color: white; }
        .em-booking input::placeholder, .em-booking textarea::placeholder { color: rgba(255,255,255,0.5); }
        .em-booking label { font-size: 12px; color: rgba(255,255,255,0.75); display: block; margin-bottom: 4px; }
      `}</style>

      {/* Grayscale background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url('${HERO_IMAGE}')`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'grayscale(100%)',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(15,23,42,0.75) 0%, rgba(15,23,42,0.45) 50%, rgba(15,23,42,0.65) 100%)' }} />

      {/* Vertical accent */}
      <div style={{
        position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%) rotate(-90deg)',
        fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)',
        whiteSpace: 'nowrap', display: 'none',
      }} className="lg-only" />

      <div style={{ position: 'relative', zIndex: 2, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* Nav */}
        <header style={{ padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <nav className="em-nav" style={{ display: 'flex', gap: '1.5rem', fontSize: 13 }}>
            {NAV_LEFT.map(l => (
              <a key={l.label} href={l.href} onClick={e => { e.preventDefault(); router.push(l.href) }}
                style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>{l.label}</a>
            ))}
          </nav>
          <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.5px' }}>PreCare GH</div>
          <nav className="em-nav" style={{ display: 'flex', gap: '1.5rem', fontSize: 13 }}>
            {NAV_RIGHT.map(l => (
              <a key={l.label} href={l.href} onClick={e => { e.preventDefault(); router.push(l.href) }}
                style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>{l.label}</a>
            ))}
          </nav>
        </header>

        {/* Hero */}
        <section style={{ flex: 1, padding: '2rem', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <button
            onClick={() => !locationError && dispatchSOS()}
            disabled={loading || !!locationError}
            style={{
              position: 'absolute', top: 0, right: '2rem',
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.9)',
              fontSize: 14, cursor: loading || locationError ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, opacity: loading || locationError ? 0.5 : 1,
            }}>
            Do you think it is an emergency?
            <Icon d="M7 17L17 7M17 7H7M17 7V17" size={14} />
          </button>

          <div style={{ maxWidth: 560 }}>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 700, lineHeight: 1.15, marginBottom: 20 }}>
              We provide total healthcare solution.
            </h1>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.8)', maxWidth: 480, marginBottom: 28 }}>
              {loading
                ? 'Locating you and finding the nearest emergency hospital…'
                : locationError
                  ? 'Allow location access to find the closest hospital and book care near you.'
                  : nearest
                    ? `Nearest emergency unit: ${nearest.name}${nearest.distance != null ? ` — ${formatDistance(nearest.distance)} away` : ''}.`
                    : 'No emergency hospitals found in the database for your area. Try the hospital directory.'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/check')}
                style={{ padding: '12px 28px', background: 'white', color: SLATE, border: 'none', borderRadius: 100, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Schedule an appointment
              </button>
              <button onClick={loadData} disabled={loading}
                style={{ padding: '12px 28px', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 100, fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                {loading ? 'Updating…' : 'Refresh location'}
              </button>
            </div>
          </div>
        </section>

        {/* Bottom cards */}
        <section style={{ padding: '0 2rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 0, maxWidth: 1200, margin: '0 auto', width: '100%' }}>

          {/* Nearest hospital card */}
          <div className="em-card" style={{ background: SLATE, padding: '2rem', borderRadius: '0 0 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>Patients and visitors</h2>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.35)' }} />)}
              </div>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>
              {loading
                ? 'Using your GPS to match you with the closest hospital that accepts emergency patients.'
                : 'Every year millions of patients visit hospitals across Ghana. Use your live location to find the nearest emergency unit and estimated arrival time.'}
            </p>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Finding closest hospital…
              </div>
            ) : locationError ? (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 16, fontSize: 14 }}>
                <strong>Location required</strong>
                <p style={{ marginTop: 6, color: 'rgba(255,255,255,0.75)' }}>{locationError}</p>
                <button onClick={loadData} style={{ marginTop: 12, padding: '8px 16px', background: 'white', color: SLATE, border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  Try again
                </button>
              </div>
            ) : nearest ? (
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{nearest.name}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 12 }}>
                  {[nearest.location, nearest.city, nearest.region].filter(Boolean).join(' · ') || address}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>Distance</div>
                    <div style={{ fontWeight: 600 }}>{formatDistance(nearest.distance) ?? '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>Ambulance ETA</div>
                    <div style={{ fontWeight: 600 }}>{eta != null ? `${eta} min` : '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>Your location</div>
                    <div style={{ fontWeight: 500, fontSize: 12 }}>{address}</div>
                  </div>
                </div>
                {hospitals.length > 1 && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>Also nearby</div>
                    {hospitals.slice(1, 4).map(h => (
                      <div key={h.id} style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                        {h.name}{h.distance != null ? ` — ${formatDistance(h.distance)}` : ''}
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => router.push('/hospitals')}
                  style={{ marginTop: 16, padding: '10px 18px', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, fontSize: 13, cursor: 'pointer', width: '100%' }}>
                  View all hospitals
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
                No hospitals with emergency services are listed yet. Add hospitals to your Supabase database to enable GPS matching.
              </div>
            )}
          </div>

          {/* Booking card */}
          <div className="em-card" style={{ background: PRIMARY, padding: '2rem', position: 'relative', overflow: 'hidden' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Book a consultation</h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', marginBottom: 20, maxWidth: 320 }}>
              Request a video or in-person appointment at {nearest?.name || 'your nearest hospital'} using your live location.
            </p>

            <form className="em-booking" onSubmit={handleBooking} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
              <div>
                <label>Full name</label>
                <input required value={booking.full_name} onChange={e => setBooking(b => ({ ...b, full_name: e.target.value }))} placeholder="Your full name" />
              </div>
              <div>
                <label>Phone number</label>
                <input required type="tel" value={booking.phone} onChange={e => setBooking(b => ({ ...b, phone: e.target.value }))} placeholder="+233 …" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Date</label>
                  <input required type="date" min={minDate} value={booking.preferred_date} onChange={e => setBooking(b => ({ ...b, preferred_date: e.target.value }))} />
                </div>
                <div>
                  <label>Time</label>
                  <input required type="time" value={booking.preferred_time} onChange={e => setBooking(b => ({ ...b, preferred_time: e.target.value }))} />
                </div>
              </div>
              <div>
                <label>Appointment type</label>
                <select value={booking.appointment_type} onChange={e => setBooking(b => ({ ...b, appointment_type: e.target.value }))}>
                  <option value="video">Video consultation</option>
                  <option value="in-person">In-person visit</option>
                  <option value="emergency">Emergency assessment</option>
                </select>
              </div>
              <div>
                <label>Notes (optional)</label>
                <textarea rows={2} value={booking.notes} onChange={e => setBooking(b => ({ ...b, notes: e.target.value }))} placeholder="Symptoms or reason for visit" />
              </div>
              <button type="submit" disabled={bookingStatus === 'loading' || loading}
                style={{ padding: '12px 24px', background: 'white', color: PRIMARY, border: 'none', borderRadius: 100, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                <Icon d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" size={16} color={PRIMARY} />
                {bookingStatus === 'loading' ? 'Booking…' : 'Connect now'}
              </button>
              {bookingMessage && (
                <p style={{ fontSize: 13, color: bookingStatus === 'error' ? '#fecaca' : 'rgba(255,255,255,0.9)' }}>{bookingMessage}</p>
              )}
            </form>
          </div>
        </section>
      </div>

      {/* SOS overlay */}
      {(phase === 'countdown' || phase === 'dispatched') && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '2.5rem', maxWidth: 420, width: '100%', textAlign: 'center', color: SLATE }}>
            {phase === 'countdown' && (
              <>
                <div style={{ width: 56, height: 56, margin: '0 auto 1rem', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" size={28} color="#dc2626" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Confirm emergency dispatch</h3>
                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Ambulance will be sent to your location in</p>
                <div style={{ fontSize: 64, fontWeight: 800, color: '#dc2626', marginBottom: 20 }}>{countdown}</div>
                <button onClick={() => { setPhase('idle'); setCountdown(null) }}
                  style={{ padding: '10px 24px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
                  Cancel
                </button>
              </>
            )}
            {phase === 'dispatched' && (
              <>
                <div style={{ width: 56, height: 56, margin: '0 auto 1rem', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" size={28} color={PRIMARY} />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: PRIMARY, marginBottom: 8 }}>Ambulance dispatched</h3>
                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
                  Emergency services notified{nearest ? ` — heading to ${nearest.name}` : ''}.
                  {eta != null && ` Estimated arrival: ${eta} minutes.`}
                </p>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'left', fontSize: 13, color: '#475569', marginBottom: 20 }}>
                  <div><strong>Location:</strong> {address}</div>
                  {nearest && <div style={{ marginTop: 6 }}><strong>Hospital:</strong> {nearest.name}</div>}
                </div>
                <button onClick={() => { setPhase('idle'); router.push('/') }}
                  style={{ padding: '12px 28px', background: PRIMARY, color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                  Return home
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
