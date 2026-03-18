import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function POST(request, { params }) {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { reply } = await request.json()

  if (!reply || !reply.trim()) {
    return Response.json({ error: 'Reply is required' }, { status: 400 })
  }

  // Pobierz opinię z DB żeby mieć google_review_id i business_id
  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .select('google_review_id, business_id')
    .eq('id', params.id)
    .single()

  if (reviewError || !review) {
    return Response.json({ error: 'Review not found' }, { status: 404 })
  }

  // Pobierz dane wizytówki (konto Google i lokalizacja)
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('google_account_id, google_location_id, google_connection_id')
    .eq('id', review.business_id)
    .single()

  if (businessError || !business) {
    return Response.json({ error: 'Business not found' }, { status: 404 })
  }

  // Pobierz token dostępu Google
  const { data: connection, error: connectionError } = await supabase
    .from('google_connections')
    .select('access_token, refresh_token, token_expires_at')
    .eq('id', business.google_connection_id)
    .single()

  if (connectionError || !connection) {
    return Response.json({ error: 'Google connection not found' }, { status: 404 })
  }

  let accessToken = connection.access_token

  // Odśwież token jeśli wygasł
  if (new Date(connection.token_expires_at) < new Date()) {
    try {
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

      if (!refreshData.access_token) {
        return Response.json({ error: 'Failed to refresh Google token' }, { status: 401 })
      }

      accessToken = refreshData.access_token
      await supabase
        .from('google_connections')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
        })
        .eq('id', business.google_connection_id)
    } catch (e) {
      return Response.json({ error: 'Token refresh failed' }, { status: 500 })
    }
  }

  // Wyślij odpowiedź do Google Business Profile API (v4)
  const googleUrl = 'https://mybusiness.googleapis.com/v4/' +
    business.google_account_id + '/' +
    business.google_location_id + '/reviews/' +
    review.google_review_id + '/reply'

  const googleResponse = await fetch(googleUrl, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment: reply.trim() }),
  })

  if (!googleResponse.ok) {
    let errorMessage = 'HTTP ' + googleResponse.status
    try {
      const errorData = await googleResponse.json()
      errorMessage = errorData?.error?.message || errorMessage
    } catch {}
    return Response.json({ error: 'Google API error: ' + errorMessage }, { status: 502 })
  }

  const googleData = await googleResponse.json()

  // Odpowiedź trafiła do Google — teraz aktualizuj DB
  const { error: dbError } = await supabase
    .from('reviews')
    .update({
      has_reply: true,
      reply_comment: reply.trim(),
      reply_update_time: googleData.updateTime || new Date().toISOString()
    })
    .eq('id', params.id)

  if (dbError) {
    return Response.json({ error: dbError.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
