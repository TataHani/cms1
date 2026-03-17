  import { cookies } from 'next/headers'
  import { createClient } from '@supabase/supabase-js'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  export async function GET() {
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, title, google_account_id, google_location_id, google_connection_id')
  .eq('title', 'Ford Plichta Gdańsk')
  .limit(1)

    if (!businesses || businesses.length === 0) {
      return Response.json({ error: 'Brak wizytówek w bazie' })
    }

    const business = businesses[0]

    const { data: connection } = await supabase
      .from('google_connections')
      .select('*')
      .eq('id', business.google_connection_id)
      .single()

    if (!connection) {
      return Response.json({ error: 'Brak połączenia Google dla tej wizytówki' })
    }

    const reviewUrl = 'https://mybusiness.googleapis.com/v4/' +
      business.google_account_id + '/' +
      business.google_location_id + '/reviews'

    const response = await fetch(reviewUrl, {
      headers: { 'Authorization': 'Bearer ' + connection.access_token }
    })

    const data = await response.json()

    return Response.json({
      business_title: business.title,
      google_account_id: business.google_account_id,
      google_location_id: business.google_location_id,
      url_called: reviewUrl,
      http_status: response.status,
      google_response: data
    })
  }
