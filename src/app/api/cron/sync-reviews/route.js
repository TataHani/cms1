import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../../lib/email'
import { getRecipients } from '../../../../lib/recipients'

export const maxDuration = 800

// Alert o negatywnej opinii wysylamy, gdy opinia pojawia sie w bazie po raz
// pierwszy. Prog wieku chroni przed zalaniem skrzynek przy imporcie historii
// (np. po ponownym podpieciu konta Google), gdy w bazie nie ma jeszcze nic.
const ALERT_MAX_AGE_DAYS = 7

// Twardy limit maili na jeden bieg crona - bezpiecznik na wypadek reimportu.
const MAX_ALERT_EMAILS_PER_RUN = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Porownanie tresci odporne na null/'' i biale znaki - inaczej opinie
// bez tekstu byly uznawane za "edytowane" przy kazdym biegu crona.
const normalizeComment = (c) => (c || '').trim()

async function fetchAllReviews(accountId, locationId, accessToken, stopAtTime) {
  let allReviews = []
  let pageToken = null

  do {
    const url = new URL(
      'https://mybusiness.googleapis.com/v4/' + accountId + '/' + locationId + '/reviews'
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
  let alertEmailsSent = 0

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
      .eq('hidden', false)

    if (!businesses) continue

    for (const business of businesses) {
      try {
        // Inkrementalny sync: pobierz max(update_time) z DB i ściągaj tylko nowsze.
        // Margines 1h - bufor na edytowane opinie i opóźnienia Google API.
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

        // Mapa do wykrywania edycji tresci. Ograniczona do tego samego zakresu
        // czasu co pobranie z Google - dalszych opinii Google i tak nie zwroci,
        // wiec nie ma czego porownywac. Wczesniej to zapytanie ciagnelo przy
        // KAZDYM biegu crona wszystkie opinie wizytowki razem z kolumna comment
        // (tysiace wierszy co 5 minut) i bylo glownym zrodlem egressu, przez
        // ktory 2026-08-26 projekt zostal zablokowany na planie free.
        let existingQuery = supabase
          .from('reviews')
          .select('id, google_review_id, comment')
          .eq('business_id', business.id)
          .limit(50000)

        if (stopAtTime) {
          existingQuery = existingQuery.gte('update_time', stopAtTime.toISOString())
        }

        const { data: existingReviews } = await existingQuery

        const existingReviewMap = new Map(
          existingReviews?.map(r => [r.google_review_id, r]) || []
        )

        const allReviews = await fetchAllReviews(
          business.google_account_id,
          business.google_location_id,
          accessToken,
          stopAtTime
        )

        // Próg "świeżości" — opinia musi być młodsza niż 20 minut żeby oznaczyć ją
        // jako nową w interfejsie (badge "nowa" przy opinii)
        const freshnessThreshold = new Date(Date.now() - 20 * 60 * 1000)

        // Próg dla alertów — tu liczy się sam fakt, że opinii jeszcze nie było
        // w bazie. Google potrafi udostępnić opinię w API z opóźnieniem, więc
        // warunek 20 minut gubił alerty o negatywnych opiniach.
        const alertAgeThreshold = new Date(Date.now() - ALERT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)

        for (const review of allReviews) {
          const existing = existingReviewMap.get(review.reviewId)
          const reviewDate = review.createTime ? new Date(review.createTime) : null

          // Opinia jest nowa tylko jeśli: nie ma jej w DB ORAZ została wystawiona niedawno
          const isNew = !existing && !!reviewDate && reviewDate > freshnessThreshold
          const isFirstSeen = !existing && !!reviewDate && reviewDate > alertAgeThreshold
          const isEdited = !!existing && normalizeComment(existing.comment) !== normalizeComment(review.comment)

          const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 }
          const starRating = ratingMap[review.starRating] || 0

          const { data: savedReview } = await supabase.from('reviews').upsert({
            business_id: business.id,
            google_review_id: review.reviewId,
            reviewer_name: review.reviewer?.displayName || 'Anonim',
            star_rating: starRating,
            comment: review.comment || '',
            has_reply: !!review.reviewReply,
            reply_comment: review.reviewReply?.comment || null,
            reply_update_time: review.reviewReply?.updateTime || null,
            is_new: isNew,
            is_edited: isEdited,
            create_time: review.createTime,
            update_time: review.updateTime
          }, {
            onConflict: 'google_review_id'
          }).select('id').single()

          const reviewDbId = savedReview?.id || existing?.id || null

          if (isNew) totalNewReviews++

          // Powiadamiamy tylko o negatywnych opiniach (1-2 gwiazdki).
          // Pozytywne nie generuja szumu - zajmie sie nimi auto-odpowiedz.
          const isNegative = starRating === 1 || starRating === 2

          if (isFirstSeen && isNegative) {
            await supabase.from('alerts').insert({
              user_id: connection.user_id,
              business_id: business.id,
              review_id: reviewDbId,
              alert_type: 'NEGATIVE_REVIEW',
              title: 'Negatywna opinia ' + starRating + '★',
              message: (review.reviewer?.displayName || 'Ktos') + ' wystawil opinie dla ' + business.title,
              is_read: false
            })

            // Mail do wszystkich osob z dostepem do wizytowki, nie tylko do
            // wlasciciela polaczenia Google.
            const recipients = alertEmailsSent < MAX_ALERT_EMAILS_PER_RUN
              ? await getRecipients(business)
              : []

            for (const email of recipients) {
              try {
                await sendEmail(
                  email,
                  'Negatywna opinia ' + starRating + '★ - ' + business.title,
                  `
                    <h2>Negatywna opinia dla ${business.title}</h2>
                    <p><strong>Ocena:</strong> ${'★'.repeat(starRating)}${'☆'.repeat(5-starRating)}</p>
                    <p><strong>Autor:</strong> ${review.reviewer?.displayName || 'Anonim'}</p>
                    <p><strong>Treść:</strong> ${review.comment || '(brak treści)'}</p>
                    <p>Jeśli nikt nie odpowie, system opublikuje odpowiedź automatycznie po 20 godzinach od wystawienia opinii.</p>
                    <p><a href="https://wizytowki.plichta.com.pl/reviews">Odpowiedz w aplikacji</a></p>
                  `
                )
                alertEmailsSent++
              } catch (e) {
                console.error('Blad wysylki maila alertu:', e)
              }
            }
          }

          if (isEdited) {
            const oldText = existing.comment?.trim() || '(brak tresci)'
            const newText = review.comment?.trim() || '(brak tresci)'
            const shorten = (t) => t.length > 140 ? t.slice(0, 140) + '...' : t

            await supabase.from('alerts').insert({
              user_id: connection.user_id,
              business_id: business.id,
              review_id: reviewDbId,
              alert_type: 'EDITED_REVIEW',
              title: 'Zmieniona opinia ' + starRating + '★',
              message: (review.reviewer?.displayName || 'Ktos') + ' zmienil opinie dla ' + business.title +
                '. Bylo: "' + shorten(oldText) + '" Jest: "' + shorten(newText) + '"',
              is_read: false
            })
          }
        }

        // Przelicz i zaktualizuj statystyki wizytówki na podstawie zsynchronizowanych opinii
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
        console.error('Reviews fetch error:', e)
      }
    }
  }

  return Response.json({
    success: true,
    newReviews: totalNewReviews,
    alertEmailsSent,
    timestamp: new Date().toISOString()
  })
}
