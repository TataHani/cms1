import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../../lib/email'
import { generateReply, brandName } from '../../../../lib/ai'
import { getRecipients } from '../../../../lib/recipients'

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// System dziala tylko na opiniach od tej daty (nie tyka historycznych).
// Ustawione na moment uruchomienia produkcyjnego (2026-08-12). Opinie starsze
// sa ignorowane - inaczej pierwszy bieg zalalby Google odpowiedziami na cala
// zalegla historie (po reimporcie VW to setki opinii z calego lata).
const CUTOFF = new Date('2026-08-12T00:00:00Z')

// Bezpiecznik: ile odpowiedzi maksymalnie opublikowac w jednym biegu crona.
// Publikacja w Google jest nieodwracalna, wiec ograniczamy skale ewentualnej
// pomylki. Cron chodzi co 15 min, wiec normalny ruch i tak sie zmiesci.
const MAX_PUBLISH_PER_RUN = 10

// Okna czasowe liczone od momentu wystawienia opinii (create_time).
// Ponaglenie idzie natychmiast po odczytaniu opinii przez system, zeby czlowiek
// mial pelne okno na wlasna odpowiedz; automat wchodzi po 15h ciszy.
const ALERT_AT_H = 0         // 1-2*: ponaglenie do ludzi od razu
const NEG_PUBLISH_AT_H = 15  // 1-2*: auto-publikacja jesli nadal cisza
const POS_PUBLISH_AT_H = 15  // 3-5*: auto-publikacja po cichu

const APP_URL = 'https://wizytowki.plichta.com.pl'

// Etap 2: sztywne formulki. W etapie 3 podmieniamy na Claude API.
function buildSuggestion(review, business) {
  const isNegative = review.star_rating === 1 || review.star_rating === 2
  const hasText = review.comment && review.comment.trim().length > 0
  const signature = `\n\nZ wyrazami szacunku,\nZespół ${brandName(business.title)}`

  if (isNegative) {
    const contact = business.phone ? ` pod numerem ${business.phone}` : ''
    return `Dziękujemy za opinię i bardzo nam przykro, że Państwa doświadczenie nie spełniło oczekiwań. Zależy nam na wyjaśnieniu sprawy, dlatego prosimy o kontakt${contact}.${signature}`
  }

  if (hasText) {
    return `Bardzo dziękujemy za pozytywną opinię i okazane zaufanie. Cieszymy się, że możemy Państwu pomagać.${signature}`
  }

  return `Dziękujemy za ocenę i zaufanie.${signature}`
}

// Zwraca wazny access_token dla polaczenia, odswiezajac go w razie potrzeby.
async function getAccessToken(connection) {
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
  if (!refreshData.access_token) return null

  await supabase
    .from('google_connections')
    .update({
      access_token: refreshData.access_token,
      token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
    })
    .eq('id', connection.id)

  return refreshData.access_token
}

// Publikuje odpowiedz do Google Business Profile (v4). Zwraca true/false.
async function publishReply(business, accessToken, googleReviewId, comment) {
  const url = 'https://mybusiness.googleapis.com/v4/' +
    business.google_account_id + '/' +
    business.google_location_id + '/reviews/' +
    googleReviewId + '/reply'

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment }),
  })

  return response.ok
}

export async function GET(request) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Kandydaci: opinie bez odpowiedzi, jeszcze nie obsluzone automatem, od cutoff.
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('has_reply', false)
    .is('auto_replied_at', null)
    .gte('create_time', CUTOFF.toISOString())
    .limit(1000)

  if (!reviews || reviews.length === 0) {
    return Response.json({ message: 'Brak opinii do obsluzenia' })
  }

  // Pobierz potrzebne wizytowki i polaczenia, zbuforuj w mapach.
  const businessIds = [...new Set(reviews.map(r => r.business_id))]
  const { data: businesses } = await supabase
    .from('businesses').select('*').in('id', businessIds)
  const businessMap = new Map(businesses?.map(b => [b.id, b]) || [])

  const connectionIds = [...new Set((businesses || []).map(b => b.google_connection_id))]
  const { data: connections } = await supabase
    .from('google_connections').select('*').in('id', connectionIds)
  const connectionMap = new Map(connections?.map(c => [c.id, c]) || [])
  const tokenCache = new Map()

  const now = Date.now()
  let alertsSent = 0
  let published = 0

  for (const review of reviews) {
    const business = businessMap.get(review.business_id)
    if (!business || !review.create_time) continue

    const ageH = (now - new Date(review.create_time).getTime()) / (1000 * 60 * 60)
    const isNegative = review.star_rating === 1 || review.star_rating === 2

    // Wygeneruj propozycje odpowiedzi, jesli jeszcze jej nie ma
    // (dostepna dla czlowieka w UI i jako material do auto-publikacji).
    let suggestion = review.suggested_reply
    if (!suggestion) {
      try {
        suggestion = await generateReply(review, business)
      } catch (e) {
        // Gdy AI zawiedzie, publikacja i tak musi miec tresc - uzywamy formulki.
        console.error('Blad generowania AI, uzywam formulki:', e)
        suggestion = buildSuggestion(review, business)
      }
      await supabase
        .from('reviews').update({ suggested_reply: suggestion }).eq('id', review.id)
    }

    // 1-2*: powiadomienie do ludzi od razu po odczytaniu opinii (raz)
    if (isNegative && ageH >= ALERT_AT_H && !review.alert_sent_at) {
      const recipients = await getRecipients(business)
      for (const email of recipients) {
        try {
          await sendEmail(
            email,
            'Negatywna opinia czeka na odpowiedz - ' + business.title,
            `
              <h2>Negatywna opinia bez odpowiedzi</h2>
              <p>Nowa opinia ${review.star_rating}★ dla <strong>${business.title}</strong> czeka na odpowiedz.</p>
              <p><strong>Tresc:</strong> ${review.comment || '(brak tresci)'}</p>
              <p>Jesli nikt nie odpowie w ciagu ${NEG_PUBLISH_AT_H}h od wystawienia opinii, system opublikuje odpowiedz automatycznie.</p>
              <p><a href="${APP_URL}/reviews">Odpowiedz teraz w aplikacji</a></p>
            `
          )
        } catch (e) {
          console.error('Blad wysylki ponaglenia:', e)
        }
      }
      await supabase
        .from('reviews').update({ alert_sent_at: new Date().toISOString() }).eq('id', review.id)
      alertsSent++
    }

    // Auto-publikacja: 15h od wystawienia opinii, niezaleznie od oceny
    const publishAt = isNegative ? NEG_PUBLISH_AT_H : POS_PUBLISH_AT_H
    if (ageH >= publishAt && published < MAX_PUBLISH_PER_RUN) {
      const connection = connectionMap.get(business.google_connection_id)
      if (!connection) continue

      let accessToken = tokenCache.get(connection.id)
      if (!accessToken) {
        accessToken = await getAccessToken(connection)
        if (accessToken) tokenCache.set(connection.id, accessToken)
      }
      if (!accessToken) continue

      const ok = await publishReply(business, accessToken, review.google_review_id, suggestion)
      if (ok) {
        await supabase
          .from('reviews')
          .update({
            has_reply: true,
            reply_comment: suggestion,
            reply_update_time: new Date().toISOString(),
            auto_replied_at: new Date().toISOString(),
            is_auto_reply: true
          })
          .eq('id', review.id)
        published++
      }
    }
  }

  return Response.json({
    success: true,
    alertsSent,
    published,
    timestamp: new Date().toISOString()
  })
}
