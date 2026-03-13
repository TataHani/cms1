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

  // Pobierz połączenie Google
  const { data: connection } = await supabase
    .from('google_connections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!connection) {
    return Response.json({ error: 'Brak polaczonego konta Google' }, { status: 400 })
  }

  let accessToken = connection.access_token

  // Odśwież token jeśli wygasł
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
      await supabase
        .from('google_connections')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
        })
        .eq('id', connection.id)
    } else {
      return Response.json({ error: 'Nie udalo sie odswiezyc tokenu' }, { status: 401 })
    }
  }

  // Pobierz wizytówki użytkownika
  const { data: businesses } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', userId)

  if (!businesses || businesses.length === 0) {
    return Response.json({ error: 'Brak wizytowek' }, { status: 404 })
  }

  let totalImported = 0

  for (const business of businesses) {
    try {
      const reviewsResponse = await fetch(
        'https://mybusiness.googleapis.com/v4/' + business.google_location_id + '/reviews',
        {
          headers: { 'Authorization': 'Bearer ' + accessToken }
        }
      )

      const reviewsData = await reviewsResponse.json()

      if (reviewsData.reviews) {
        for (const review of reviewsData.reviews) {
          const existingReview = await supabase
            .from('reviews')
            .select('id, comment')
            .eq('google_review_id', review.reviewId)
            .single()

          const isEdited = existingReview?.data && existingReview.data.comment !== review.comment

          await supabase.from('reviews').upsert({
            business_id: business.id,
            google_review_id: review.reviewId,
            reviewer_name: review.reviewer?.displayName || 'Anonim',
            star_rating: parseInt(review.starRating?.replace('STAR_RATING_', '').replace('ONE', '1').replace('TWO', '2').replace('THREE', '3').replace('FOUR', '4').replace('FIVE', '5')) || 0,
            comment: review.comment || '',
            has_reply: !!review.reviewReply,
            reply_comment: review.reviewReply?.comment || null,
            is_new: !existingReview?.data,
            is_edited: isEdited,
            create_time: review.createTime
          }, {
            onConflict: 'google_review_id'
          })

          totalImported++
        }
      }
    } catch (e) {
      console.error('Error fetching reviews for', business.title, e)
    }
  }

  return Response.json({ success: true, imported: totalImported })
}
