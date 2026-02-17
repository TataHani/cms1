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

  // Pobierz tokeny użytkownika
  const { data: user } = await supabase
    .from('users')
    .select('google_access_token')
    .eq('id', userId)
    .single()

  if (!user?.google_access_token) {
    return Response.json({ error: 'No Google token' }, { status: 401 })
  }

  try {
    // Pobierz konta Google Business
    const accountsResponse = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: {
          'Authorization': 'Bearer ' + user.google_access_token
        }
      }
    )

    const accountsData = await accountsResponse.json()

    if (!accountsData.accounts || accountsData.accounts.length === 0) {
      return Response.json({ 
        error: 'Brak kont Google Business Profile',
        message: 'Nie znaleziono żadnych kont. Upewnij się, że masz dostęp do wizytówek Google.'
      }, { status: 404 })
    }

    // Pobierz lokalizacje dla każdego konta
    const allLocations = []

    for (const account of accountsData.accounts) {
      const locationsResponse = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri`,
        {
          headers: {
            'Authorization': 'Bearer ' + user.google_access_token
          }
        }
      )

      const locationsData = await locationsResponse.json()

      if (locationsData.locations) {
        for (const location of locationsData.locations) {
          // Zapisz do bazy
          await supabase.from('businesses').upsert({
            user_id: userId,
            google_account_id: account.name,
            google_location_id: location.name,
            location_name: location.name,
            title: location.title,
            address: location.storefrontAddress?.addressLines?.join(', ') || '',
            phone: location.phoneNumbers?.primaryPhone || '',
            website: location.websiteUri || '',
            last_synced_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,google_location_id'
          })

          allLocations.push(location)
        }
      }
    }

    // Przekieruj z powrotem do dashboardu
    return Response.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'https://cms1-rwp1.vercel.app'))

  } catch (error) {
    console.error('Error fetching locations:', error)
    return Response.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }
}
