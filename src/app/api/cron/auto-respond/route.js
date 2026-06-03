import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../../lib/email'
import { generateReply } from '../../../../lib/ai'

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// System dziala tylko na opiniach od tej daty (nie tyka historycznych).
// Przy wdrozeniu produkcyjnym ustawic na realny moment startu.
const CUTOFF = new Date('2026-06-03T00:00:00Z')

// Okna czasowe liczone od momentu wystawienia opinii (create_time).
const ALERT_AT_H = 20        // 1-2*: ponaglenie do ludzi
const NEG_PUBLISH_AT_H = 23  // 1-2*: auto-publikacja jesli nadal cisza
const POS_PUBLISH_AT_H = 22  // 3-5*: auto-publikacja po cichu

const APP_URL = 'https://cms1-rwp1.vercel.app'

// Etap 2: sztywne formulki. W etapie 3 podmieniamy na Claude API.
function buildSuggestion(review, business) {
  const isNegative = review.star_rating === 1 || review.star_rating === 2
  const hasText = review.comment && review.comment.trim().length > 0

  if (isNegative) {
    const contact = business.phone ? ` pod numerem ${business.phone}` : ''
    return `Dziękujemy za opinię i bardzo nam przykro, że Państwa doświadczenie nie spełniło oczekiwań. Zależy nam na wyjaśnieniu sprawy, dlatego prosimy o kontakt${contact}. Pozdrawiamy, zespół ${business.title}.`
  }

  if (hasText) {
    return `Bardzo dziękujemy za pozytywną opinię i okazane zaufanie. Cieszymy się, że możemy Państwu pomagać. Pozdrawiamy, zespół ${business.title}.`
  }

  return `Dziękujemy za ocenę i zaufanie. Pozdrawiamy, zespół ${business.title}.`
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

// Emaile osob z dostepem do wizytowki: wlasciciel + uprawnieni + admini.
async function getRecipients(business) {
  const emails = new Set()

  const { data: owner } = await supabase
    .from('users').select('email').eq('id', business.user_id).single()
  if (owner?.email) emails.add(owner.email)

  const { data: perms } = await supabase
    .from('business_permissions').select('user_id').eq('business_id', business.id)
  if (perms && perms.length > 0) {
    const { data: permUsers } = await supabase
      .from('users').select('email').in('id', perms.map(p => p.user_id))
    permUsers?.forEach(u => u.email && emails.add(u.email))
  }

  const { data: admins } = await supabase
    .from('users').select('email').eq('role', 'admin')
  admins?.forEach(a => a.email && emails.add(a.email))

  return [...emails]
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

    // 1-2*: ponaglenie do ludzi po 20h (raz)
    if (isNegative && ageH >= ALERT_AT_H && !review.alert_sent_at) {
      const recipients = await getRecipients(business)
      for (const email of recipients) {
        try {
          await sendEmail(
            email,
            'Negatywna opinia czeka na odpowiedz - ' + business.title,
            `
              <h2>Negatywna opinia bez odpowiedzi</h2>
              <p>Opinia ${review.star_rating}★ dla <strong>${business.title}</strong> czeka na odpowiedz juz ${Math.floor(ageH)}h.</p>
              <p><strong>Tresc:</strong> ${review.comment || '(brak tresci)'}</p>
              <p>Jesli nikt nie odpowie w ciagu ok. 3h, system opublikuje odpowiedz automatycznie.</p>
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

    // Auto-publikacja: 1-2* po 23h, 3-5* po 22h
    const publishAt = isNegative ? NEG_PUBLISH_AT_H : POS_PUBLISH_AT_H
    if (ageH >= publishAt) {
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
