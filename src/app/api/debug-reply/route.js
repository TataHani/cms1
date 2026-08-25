import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Ile stron opinii maksymalnie ciagnac z Google (50 opinii na strone).
const MAX_PAGES = 3

async function getAccessToken(connection) {
  if (new Date(connection.token_expires_at) >= new Date()) {
    return connection.access_token
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json()
  if (!data.access_token) return null

  await supabase
    .from('google_connections')
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
    })
    .eq('id', connection.id)

  return data.access_token
}

// Porownuje stan odpowiedzi w bazie ze stanem w Google Business Profile.
// Nic nie zapisuje w reviews - sluzy wylacznie do diagnozy "panel mowi, ze
// odpowiedz jest, a na Google jej nie widac".
export async function GET(request) {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (user?.role !== 'admin') {
    return Response.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const businessQuery = searchParams.get('business')
  const days = Number(searchParams.get('days')) || 7
  const reviewerQuery = searchParams.get('reviewer')
  const includeRaw = searchParams.get('raw') === '1'

  if (!businessQuery) {
    return Response.json({
      error: 'Podaj nazwe wizytowki, np. /api/debug-reply?business=Audi Centrum Gdynia&days=7'
    }, { status: 400 })
  }

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, title, google_account_id, google_location_id, google_connection_id')
    .ilike('title', '%' + businessQuery + '%')

  if (!businesses || businesses.length === 0) {
    return Response.json({ error: 'Nie znaleziono wizytowki: ' + businessQuery }, { status: 404 })
  }

  if (businesses.length > 1) {
    return Response.json({
      error: 'Zapytanie pasuje do kilku wizytowek, doprecyzuj nazwe',
      matches: businesses.map(b => b.title)
    }, { status: 400 })
  }

  const business = businesses[0]

  const { data: connection } = await supabase
    .from('google_connections')
    .select('*')
    .eq('id', business.google_connection_id)
    .single()

  if (!connection) {
    return Response.json({ error: 'Brak polaczenia Google dla tej wizytowki' }, { status: 404 })
  }

  const accessToken = await getAccessToken(connection)
  if (!accessToken) {
    return Response.json({ error: 'Nie udalo sie odswiezyc tokenu Google' }, { status: 401 })
  }

  // Pobierz opinie prosto z Google (bez zapisu do bazy)
  const googleReviews = []
  let pageToken = null
  let pages = 0

  do {
    const url = new URL(
      'https://mybusiness.googleapis.com/v4/' +
      business.google_account_id + '/' +
      business.google_location_id + '/reviews'
    )
    url.searchParams.set('pageSize', '50')
    url.searchParams.set('orderBy', 'updateTime desc')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    })

    const data = await response.json()

    if (!response.ok) {
      return Response.json({
        error: 'Google API error',
        http_status: response.status,
        google_response: data
      }, { status: 502 })
    }

    if (data.reviews) googleReviews.push(...data.reviews)
    pageToken = data.nextPageToken || null
    pages++
  } while (pageToken && pages < MAX_PAGES)

  const googleMap = new Map(googleReviews.map(r => [r.reviewId, r]))

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let dbQuery = supabase
    .from('reviews')
    .select('id, google_review_id, reviewer_name, star_rating, create_time, has_reply, reply_comment, reply_update_time, is_auto_reply, auto_replied_at')
    .eq('business_id', business.id)
    .gte('create_time', since)
    .order('create_time', { ascending: false })

  // Zawezenie do jednego autora - do porownywania pojedynczych przypadkow
  // (odpowiedz widoczna vs niewidoczna publicznie) bez scian JSON-a.
  if (reviewerQuery) {
    dbQuery = dbQuery.ilike('reviewer_name', '%' + reviewerQuery + '%')
  }

  const { data: dbReviews } = await dbQuery

  const comparison = (dbReviews || []).map(row => {
    const g = googleMap.get(row.google_review_id)
    const googleHasReply = g ? !!g.reviewReply : null

    let status
    if (!g) {
      status = 'BRAK W GOOGLE (opinia usunieta lub poza pobranym zakresem)'
    } else if (row.has_reply && googleHasReply) {
      status = 'OK (odpowiedz jest po obu stronach)'
    } else if (row.has_reply && !googleHasReply) {
      status = 'ROZBIEZNOSC (baza ma odpowiedz, Google nie)'
    } else if (!row.has_reply && googleHasReply) {
      status = 'ROZBIEZNOSC (Google ma odpowiedz, baza nie)'
    } else {
      status = 'BEZ ODPOWIEDZI po obu stronach'
    }

    return {
      status,
      reviewer: row.reviewer_name,
      stars: row.star_rating,
      create_time: row.create_time,
      // Pelny obiekt prosto z Google - pokazuje pola, ktorych nie mapujemy
      // do bazy (dane autora, sciezka name, znaczniki czasu).
      ...(includeRaw ? { raw_google: g || null } : {}),
      db: {
        has_reply: row.has_reply,
        is_auto_reply: row.is_auto_reply,
        auto_replied_at: row.auto_replied_at,
        reply_update_time: row.reply_update_time,
        reply_comment: row.reply_comment
      },
      google: g ? {
        has_reply: googleHasReply,
        reply_update_time: g.reviewReply?.updateTime || null,
        reply_comment: g.reviewReply?.comment || null,
        review_update_time: g.updateTime
      } : null
    }
  })

  return Response.json({
    business: business.title,
    google_account_id: business.google_account_id,
    google_location_id: business.google_location_id,
    days,
    reviewer_filter: reviewerQuery || null,
    google_reviews_fetched: googleReviews.length,
    db_reviews_in_range: comparison.length,
    mismatches: comparison.filter(c => c.status.startsWith('ROZBIEZNOSC') || c.status.startsWith('BRAK')).length,
    reviews: comparison
  })
}
