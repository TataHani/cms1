import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET(request) {
  // Weryfikacja że to Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    // Pozwól też bez CRON_SECRET na początek (do testów)
    // return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pobierz wszystkie połączenia Google
  const { data: connections } = await supabase
    .from('google_connections')
    .select('*')

  if (!connections || connections.length === 0) {
    return Response.json({ message: 'Brak polaczen Google' })
  }

  let totalNewReviews = 0
  let errors = []

  for (const connection of connections) {
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
          errors.push('Token refresh failed for ' + connection.google_email)
          continue
        }
      } catch (e) {
        errors.push('Token refresh error: ' + e.message)
        continue
      }
    }

    // Pobierz wizytówki tego użytkownika
    const { data: businesses } = await supabase
      .from('businesses')
      .select('*')
      .eq('google_connection_id', connection.id)

    if (!businesses) continue

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
            // Sprawdź czy opinia już istnieje
            const { data: existingReview } = await supabase
              .from('reviews')
              .select('id, comment')
              .eq('google_review_id', review.reviewId)
              .single()

            const isNew = !existingReview
            const isEdited = existingReview && existingReview.comment !== (review.comment || '')

            // Parsuj ocenę
            let starRating = 0
            if (review.starRating) {
              const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 }
              starRating = ratingMap[review.starRating] || 0
            }

            await supabase.from('reviews').upsert({
              business_id: business.id,
              google_review_id: review.reviewId,
              reviewer_name: review.reviewer?.displayName || 'Anonim',
              star_rating: starRating,
              comment: review.comment || '',
              has_reply: !!review.reviewReply,
              reply_comment: review.reviewReply?.comment || null,
              is_new: isNew,
              is_edited: isEdited,
              create_time: review.createTime
            }, {
              onConflict: 'google_review_id'
            })

            // Jeśli nowa opinia - utwórz alert i wyślij email
            if (isNew) {
              totalNewReviews++

              // Utwórz alert
              await supabase.from('alerts').insert({
                user_id: connection.user_id,
                business_id: business.id,
                alert_type: 'NEW_REVIEW',
                title: 'Nowa opinia ' + starRating + '★',
                message: review.reviewer?.displayName + ' wystawil nowa opinie dla ' + business.title,
                is_read: false
              })

              // Wyślij email (jeśli skonfigurowany Resend)
              if (process.env.RESEND_API_KEY) {
                try {
                  await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      from: 'GMB Manager <noreply@resend.dev>',
                      to: process.env.NOTIFICATION_EMAIL,
                      subject: 'Nowa opinia ' + starRating + '★ - ' + business.title,
                      html: `
                        <h2>Nowa opinia dla ${business.title}</h2>
                        <p><strong>Ocena:</strong> ${'★'.repeat(starRating)}${'☆'.repeat(5-starRating)}</p>
                        <p><strong>Autor:</strong> ${review.reviewer?.displayName || 'Anonim'}</p>
                        <p><strong>Treść:</strong> ${review.comment || '(brak treści)'}</p>
                        <p><a href="https://cms1-rwp1.vercel.app/reviews">Zobacz w aplikacji</a></p>
                      `
                    })
                  })
                } catch (emailError) {
                  console.error('Email error:', emailError)
                }
              }
            }

            // Jeśli edytowana opinia - utwórz alert
            if (isEdited) {
              await supabase.from('alerts').insert({
                user_id: connection.user_id,
                business_id: business.id,
                alert_type: 'EDITED_REVIEW',
                title: 'Edytowana opinia',
                message: review.reviewer?.displayName + ' zmienil opinie dla ' + business.title,
                is_read: false
              })
            }
          }
        }
      } catch (e) {
        errors.push('Reviews fetch error for ' + business.title + ': ' + e.message)
      }
    }
  }

  return Response.json({
    success: true,
    newReviews: totalNewReviews,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString()
  })
}
