import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET() {
  try {
    const cookieStore = cookies()
    const userId = cookieStore.get('user_id')?.value

    if (!userId) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: connection, error: connError } = await supabase
      .from('google_connections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (connError) {
      return Response.json({ error: 'Connection error', details: connError })
    }

    if (!connection) {
      return Response.json({ error: 'Brak polaczonego konta Google' })
    }

    let accessToken = connection.access_token

    if (new Date(connection.token_expires_at) < new Date()) {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: connection.refresh_token,
          grant_type: 'refresh_token',
        }),
      })
      const refreshData = await refreshResponse.json()
      if (refreshData.access_token) {
        accessToken = refreshData.access_token
      } else {
        return Response.json({ error: 'Token refresh failed', details: refreshData })
      }
    }

    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', userId)

    if (bizError) {
      return Response.json({ error: 'Business error', details: bizError })
    }

    if (!businesses || businesses.length === 0) {
      return Response.json({ error: 'Brak wizytowek' })
    }

    let results = []

    for (const business of businesses) {
const reviewsResponse = await fetch(
  'https://mybusiness.googleapis.com/v4/' + business.google_account_id + '/' + business.google_location_id + '/reviews',
        {
          headers: { 'Authorization': 'Bearer ' + accessToken }
        }
      )

      const reviewsData = await reviewsResponse.json()

      results.push({
        business: business.title,
        location_id: business.google_location_id,
        api_response: reviewsData
      })
    }

    return Response.json({ results })
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
