import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Endpoint diagnostyczny — pokazuje co dokładnie zostanie wysłane do Google
// Wywołaj: GET /api/debug-reply?review_db_id=UUID_OPINII_Z_BAZY
export async function GET(request) {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: user } = await supabase.from('users').select('role').eq('id', userId).single()
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const reviewDbId = searchParams.get('review_db_id')

  if (!reviewDbId) {
    // Jeśli nie podano ID — zwróć ostatnie 5 opinii z has_reply=true żeby znaleźć właściwą
    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, google_review_id, has_reply, reply_comment, business_id')
      .eq('has_reply', true)
      .order('id', { ascending: false })
      .limit(5)
    return Response.json({ reviews })
  }

  const { data: review } = await supabase
    .from('reviews')
    .select('google_review_id, business_id')
    .eq('id', reviewDbId)
    .single()

  if (!review) return Response.json({ error: 'Review not found' })

  const { data: business } = await supabase
    .from('businesses')
    .select('google_account_id, google_location_id, google_connection_id')
    .eq('id', review.business_id)
    .single()

  const { data: connection } = await supabase
    .from('google_connections')
    .select('access_token, token_expires_at')
    .eq('id', business.google_connection_id)
    .single()

  const locationId = business.google_location_id.replace('locations/', '')
  const replyUrl = 'https://mybusinessreviews.googleapis.com/v1/locations/' +
    locationId + '/reviews/' +
    review.google_review_id + '/reply'

  // Test PUT — wyślij testową odpowiedź i pokaż co Google zwraca
  let putStatus = null
  let putBody = null
  try {
    const putResponse = await fetch(replyUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + connection.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ comment: 'TEST - debug reply, prosze zignorowac' })
    })
    putStatus = putResponse.status
    const text = await putResponse.text()
    try { putBody = JSON.parse(text) } catch { putBody = text.substring(0, 500) }
  } catch (e) {
    putBody = 'fetch error: ' + e.message
  }

  return Response.json({
    google_review_id: review.google_review_id,
    google_account_id: business.google_account_id,
    google_location_id: business.google_location_id,
    reply_url: replyUrl,
    token_expired: new Date(connection.token_expires_at) < new Date(),
    put_status: putStatus,
    put_response: putBody
  })
}
