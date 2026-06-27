import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat'))
    const long = parseFloat(searchParams.get('long'))
    
    // Fetch all hospitals
    const { data: hospitals, error } = await supabase
      .from('hospitals')
      .select('*')
      .order('name')
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    // If coordinates provided, calculate distances
    let result = hospitals
    if (lat && long && hospitals) {
      result = hospitals.map(h => {
        if (h.latitude && h.longitude) {
          const distance = calculateDistance(lat, long, h.latitude, h.longitude)
          return { ...h, distance }
        }
        return { ...h, distance: null }
      })
      
      // Sort by distance
      result.sort((a, b) => {
        if (a.distance === null) return 1
        if (b.distance === null) return -1
        return a.distance - b.distance
      })
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}