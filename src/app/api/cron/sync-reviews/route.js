import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) return

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'GMB Manager <noreply@resend.dev>',
        to: to,
        subject: subject,
        html: html
      })
    })
  } catch (e) {
    console.error('Email error:', e)
  }
}

export async function GET(request) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connections } = await supabase
    .from('google_connections')
    .select('*')

  if (!connections || connections.length === 0) {
    return Response.json({ message: 'Brak polaczen Google' })
  }

  let totalNewReviews = 0

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
          continue
        }
      } catch (e) {
        continue
      }
    }

    // Pobierz wizytówki tego użytkownika
    const { data: businesses } = await supabase
      .from('businesses')
      .select('*')
      .eq('google_connection_id', connection.id)

    if (!businesses) continue

    // Pobierz ustawienia alertów użytkownika
    const { data: alertSettings } = await supabase
      .from('alert_settings')
      .select('*')
      .eq('user_id', connection.user_id)

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
            const { data: existingReview } = await supabase
              .from('reviews')
              .select('id, comment')
              .eq('google_review_id', review.reviewId)
              .single()

            const isNew = !existingReview
            const isEdited = existingReview && existingReview.comment !== (review.comment || '')

            const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 }
            const starRating = ratingMap[review.starRating] || 0

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

            if (isNew) {
              totalNewReviews++

              // Utwórz alert w systemie
              await supabase.from('alerts').insert({
                user_id: connection.user_id,
                business_id: business.id,
                alert_type: 'NEW_REVIEW',
                title: 'Nowa opinia ' + starRating + '★',
                message: (review.reviewer?.displayName || 'Ktos') + ' wystawil opinie dla ' + business.title,
                is_read: false
              })

              // Sprawdź czy wysłać email na podstawie ustawień
              if (alertSettings && alertSettings.length > 0) {
                for (const setting of alertSettings) {
                  // Sprawdź czy reguła pasuje
                  const matchesBusiness = !setting.business_id || setting.business_id === business.id
                  const matchesStars = starRating >= setting.min_stars && starRating <= setting.max_stars

                  if (matchesBusiness && matchesStars && setting.email_address) {
                    await sendEmail(
                      setting.email_address,
                      'Nowa opinia ' + starRating + '★ - ' + business.title,
                      `
                        <h2>Nowa opinia dla ${business.title}</h2>
                        <p><strong>Ocena:</strong> ${'★'.repeat(starRating)}${'☆'.repeat(5-starRating)}</p>
                        <p><strong>Autor:</strong> ${review.reviewer?.displayName || 'Anonim'}</p>
                        <p><strong>Treść:</strong> ${review.comment || '(brak treści)'}</p>
                        <p><a href="https://cms1-rwp1.vercel.app/reviews">Zobacz w aplikacji</a></p>
                      `
                    )
                  }
                }
              }
            }

            if (isEdited) {
              await supabase.from('alerts').insert({
                user_id: connection.user_id,
                business_id: business.id,
                alert_type: 'EDITED_REVIEW',
                title: 'Edytowana opinia',
                message: (review.reviewer?.displayName || 'Ktos') + ' zmienil opinie dla ' + business.title,
                is_read: false
              })
            }
          }

          // Przelicz i zaktualizuj statystyki wizytówki na podstawie zsynchronizowanych opinii
          const { data: allReviews } = await supabase
            .from('reviews')
            .select('star_rating')
            .eq('business_id', business.id)

          if (allReviews && allReviews.length > 0) {
            const totalReviews = allReviews.length
            const avgRating = (allReviews.reduce((sum, r) => sum + r.star_rating, 0) / totalReviews).toFixed(1)

            await supabase
              .from('businesses')
              .update({ total_reviews: totalReviews, average_rating: avgRating })
              .eq('id', business.id)
          }
        }
      } catch (e) {
        console.error('Reviews fetch error:', e)
      }
    }
  }

  return Response.json({
    success: true,
    newReviews: totalNewReviews,
    timestamp: new Date().toISOString()
  })
}
