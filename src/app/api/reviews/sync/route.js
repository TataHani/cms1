import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function refreshAccessToken(connection) {
  if (new Date(connection.token_expires_at) >= new Date()) {
    return connection.access_token
  }

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
    return null
  }

  await supabase
    .from('google_connections')
    .update({
      access_token: refreshData.access_token,
      token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
    })
    .eq('id', connection.id)

  return refreshData.access_token
}

async function fetchAllReviews(accountId, locationId, accessToken, stopAtTime) {
  let allReviews = []
  let pageToken = null

  do {
    const url = new URL(
      'https://mybusiness.googleapis.com/v4/accounts/' + accountId + '/locations/' + locationId + '/reviews'
    )
    url.searchParams.set('pageSize', '50')
    url.searchParams.set('orderBy', 'updateTime desc')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    })

    const data = await response.json()

    if (data.reviews) {
      allReviews = allReviews.concat(data.reviews)

      if (stopAtTime) {
        const lastReview = data.reviews[data.reviews.length - 1]
        if (lastReview?.updateTime && new Date(lastReview.updateTime) < stopAtTime) {
          break
        }
      }
    }

    pageToken = data.nextPageToken || null
  } while (pageToken)

  if (stopAtTime) {
    allReviews = allReviews.filter(r =>
      r.updateTime && new Date(r.updateTime) >= stopAtTime
    )
  }

  return allReviews
}

export async function GET() {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Pobierz WSZYSTKIE połączenia Google użytkownika (nie tylko najnowsze)
  const { data: connections } = await supabase
    .from('google_connections')
    .select('*')
    .eq('user_id', userId)

  if (!connections || connections.length === 0) {
    return Response.json({ error: 'Brak polaczonego konta Google' }, { status: 400 })
  }

  const errors = []
  let totalImported = 0
  const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 }

  for (const connection of connections) {
    const accessToken = await refreshAccessToken(connection)
    if (!accessToken) {
      errors.push('Nie udalo sie odswiezyc tokenu dla konta ' + (connection.google_email || connection.id))
      continue
    }

    // Pobierz wizytówki należące do TEGO konkretnego połączenia
    // (a nie wszystkie wizytówki usera - inaczej używamy złego tokenu)
    const { data: businesses } = await supabase
      .from('businesses')
      .select('*')
      .eq('google_connection_id', connection.id)

    if (!businesses || businesses.length === 0) continue

    for (const business of businesses) {
      try {
        const accountId = business.google_account_id.replace('accounts/', '')
        const locationId = business.google_location_id.replace('locations/', '')

        // Inkrementalny sync: pobierz max(update_time) z DB, ściągaj tylko nowsze (margines 1h)
        const { data: latestReview } = await supabase
          .from('reviews')
          .select('update_time')
          .eq('business_id', business.id)
          .not('update_time', 'is', null)
          .order('update_time', { ascending: false })
          .limit(1)
          .maybeSingle()

        const stopAtTime = latestReview?.update_time
          ? new Date(new Date(latestReview.update_time).getTime() - 60 * 60 * 1000)
          : null

        const allReviews = await fetchAllReviews(accountId, locationId, accessToken, stopAtTime)

        for (const review of allReviews) {
          const existingReview = await supabase
            .from('reviews')
            .select('id, comment')
            .eq('google_review_id', review.reviewId)
            .single()

          const isEdited = existingReview?.data && existingReview.data.comment !== (review.comment || '')
          const starRating = ratingMap[review.starRating] || 0

          await supabase.from('reviews').upsert({
            business_id: business.id,
            google_review_id: review.reviewId,
            reviewer_name: review.reviewer?.displayName || 'Anonim',
            star_rating: starRating,
            comment: review.comment || '',
            has_reply: !!review.reviewReply,
            reply_comment: review.reviewReply?.comment || null,
            reply_update_time: review.reviewReply?.updateTime || null,
            is_new: !existingReview?.data,
            is_edited: isEdited,
            create_time: review.createTime,
            update_time: review.updateTime
          }, {
            onConflict: 'google_review_id'
          })

          totalImported++
        }

        // Przelicz statystyki wizytówki
        const { data: allDbReviews } = await supabase
          .from('reviews')
          .select('star_rating')
          .eq('business_id', business.id)
          .limit(50000)

        if (allDbReviews && allDbReviews.length > 0) {
          const totalReviews = allDbReviews.length
          const avgRating = (allDbReviews.reduce((sum, r) => sum + r.star_rating, 0) / totalReviews).toFixed(1)

          await supabase
            .from('businesses')
            .update({ total_reviews: totalReviews, average_rating: avgRating })
            .eq('id', business.id)
        }
      } catch (e) {
        errors.push('Blad pobierania opinii dla ' + business.title + ': ' + e.message)
      }
    }
  }

  return Response.json({
    success: true,
    imported: totalImported,
    errors: errors.length > 0 ? errors : undefined
  })
}
