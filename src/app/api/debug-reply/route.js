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

  // Pobierz opinie z v4 API żeby zobaczyć jak wygląda review.name
  let v4ReviewsStatus = null
  let v4ReviewSample = null
  try {
    const v4Url = 'https://mybusiness.googleapis.com/v4/' +
      business.google_account_id + '/' +
      business.google_location_id + '/reviews?pageSize=1'
    const v4Res = await fetch(v4Url, {
      headers: { 'Authorization': 'Bearer ' + connection.access_token }
    })
    v4ReviewsStatus = v4Res.status
    const v4Data = await v4Res.json()
    if (v4Data.reviews?.[0]) {
      v4ReviewSample = {
        name: v4Data.reviews[0].name,
        reviewId: v4Data.reviews[0].reviewId
      }
    }
  } catch (e) {
    v4ReviewSample = 'error: ' + e.message
  }

  // Spróbuj pobrać opinie też z v1 API
  const locationId = business.google_location_id.replace('locations/', '')
  let v1ReviewsStatus = null
  let v1ReviewSample = null
  try {
    const v1Url = 'https://mybusinessreviews.googleapis.com/v1/locations/' + locationId + '/reviews?pageSize=1'
    const v1Res = await fetch(v1Url, {
      headers: { 'Authorization': 'Bearer ' + connection.access_token }
    })
    v1ReviewsStatus = v1Res.status
    const text = await v1Res.text()
    try { v1ReviewSample = JSON.parse(text) } catch { v1ReviewSample = text.substring(0, 300) }
  } catch (e) {
    v1ReviewSample = 'error: ' + e.message
  }

  return Response.json({
    stored_in_db: {
      google_review_id: review.google_review_id,
      google_account_id: business.google_account_id,
      google_location_id: business.google_location_id,
    },
    v4_reviews_status: v4ReviewsStatus,
    v4_review_name_sample: v4ReviewSample,
    v1_reviews_status: v1ReviewsStatus,
    v1_response: v1ReviewSample
  })
}
