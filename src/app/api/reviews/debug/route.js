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

    const { data: connection } = await supabase
      .from('google_connections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

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

    // Pobierz konta
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { 'Authorization': 'Bearer ' + accessToken } }
    )
    const accountsData = await accountsRes.json()

    if (!accountsData.accounts) {
  return Response.json({ error: 'Brak kont', accounts: accountsData })
}

// Debug - pokaż konta i lokalizacje
let debug = { accounts: [] }

for (const account of accountsData.accounts) {
  const locationsRes = await fetch(
    'https://mybusinessbusinessinformation.googleapis.com/v1/' + account.name + '/locations',
    { headers: { 'Authorization': 'Bearer ' + accessToken } }
  )
  const locationsData = await locationsRes.json()
  
  debug.accounts.push({
    name: account.name,
    locations: locationsData
  })
}

return Response.json({ debug })

    let results = []

    for (const account of accountsData.accounts) {
      // Pobierz lokalizacje
      const locationsRes = await fetch(
        'https://mybusinessbusinessinformation.googleapis.com/v1/' + account.name + '/locations',
        { headers: { 'Authorization': 'Bearer ' + accessToken } }
      )
      const locationsData = await locationsRes.json()

      for (const location of (locationsData.locations || [])) {
        // Spróbuj różnych endpointów do opinii
        const endpoints = [
          'https://mybusiness.googleapis.com/v4/' + account.name + '/' + location.name + '/reviews',
          'https://mybusinessaccountmanagement.googleapis.com/v1/' + location.name + '/reviews',
        ]

        for (const endpoint of endpoints) {
          const reviewsRes = await fetch(endpoint, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
          })
          
          let reviewsData
          const text = await reviewsRes.text()
          try {
            reviewsData = JSON.parse(text)
          } catch {
            reviewsData = { raw: text.substring(0, 200) }
          }

          results.push({
            account: account.name,
            location: location.name,
            title: location.title,
            endpoint: endpoint,
            status: reviewsRes.status,
            response: reviewsData
          })
        }
      }
    }

    return Response.json({ results })
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
