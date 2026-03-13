import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET() {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Pobierz połączenie Google użytkownika
  const { data: connection } = await supabase
    .from('google_connections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!connection) {
    return Response.json({ error: 'Brak polaczonego konta Google. Wejdz w Ustawienia i polacz konto.' }, { status: 400 })
  }

  let accessToken = connection.access_token

  // Sprawdź czy token wygasł - jeśli tak, odśwież go
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

      // Zapisz nowy token
      await supabase
        .from('google_connections')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
        })
        .eq('id', connection.id)
    } else {
      return Response.json({ error: 'Nie udalo sie odswiezyc tokenu. Polacz konto Google ponownie.' }, { status: 401 })
    }
  }

  try {
    const accountsResponse = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      }
    )

    const accountsData = await accountsResponse.json()

    if (accountsData.error) {
      return Response.json({ error: accountsData.error.message, details: accountsData }, { status: accountsData.error.code })
    }

    if (!accountsData.accounts || accountsData.accounts.length === 0) {
      return Response.json({ error: 'Brak kont Google Business Profile na tym koncie.' }, { status: 404 })
    }

    let importedCount = 0

    for (const account of accountsData.accounts) {
      const locationsResponse = await fetch(
        'https://mybusinessbusinessinformation.googleapis.com/v1/' + account.name + '/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri',
        {
          headers: { 'Authorization': 'Bearer ' + accessToken }
        }
      )

      const locationsData = await locationsResponse.json()

      if (locationsData.locations) {
        for (const location of locationsData.locations) {
          await supabase.from('businesses').upsert({
            user_id: userId,
            google_connection_id: connection.id,
            google_account_id: account.name,
            google_location_id: location.name,
            location_name: location.name,
            title: location.title || 'Bez nazwy',
            address: location.storefrontAddress?.addressLines?.join(', ') || '',
            phone: location.phoneNumbers?.primaryPhone || '',
            website: location.websiteUri || '',
            last_synced_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,google_location_id'
          })
          importedCount++
        }
      }
    }

    return Response.json({ success: true, imported: importedCount })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
