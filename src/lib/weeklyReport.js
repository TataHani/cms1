// Dane do cotygodniowego raportu opinii Skody dla Dyrektora Serwisu.
import { parseReviewComment } from './reviewText'

// Kolejnosc = kolejnosc w mailu. Pozostale wizytowki Skody to punkty serwisowe
// innych marek i nie wchodza do raportu. Przypiete po google_location_id, bo
// tytuly w Google nie pasuja do nazw uzywanych w firmie (Lubicz Dolny to w Google
// "Toruń", Lubowidzka to "Gdańsk Szadółki").
export const SKODA_LOCATIONS = [
  { name: 'Lubicz Dolny', googleLocationId: 'locations/15648624070644171142' },
  { name: 'Wejherowo', googleLocationId: 'locations/10412590210048085561' },
  { name: 'Gdynia', googleLocationId: 'locations/15723146772742005549' },
  { name: 'Gdańsk Lubowidzka', googleLocationId: 'locations/5854647733596230854' },
  { name: 'Gdańsk Grunwaldzka', googleLocationId: 'locations/1386008451320649169' },
  { name: 'Gdańsk Stadion', googleLocationId: 'locations/12299652438836470900' },
]

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const PAGE = 1000

// Zapasowe rozpoznawanie opinii serwisowych, gdy Claude API nie odpowie.
const SERVICE_KEYWORDS = /serwis|przegl[aą]d|napraw|warsztat|mechani|doradc|gwarancj|wymian|diagnost|olej|opon|blacharn|lakiern|cz[eę][sś]ci|usterk|awari|klimatyzac|hamulc|rozrz[aą]d|akumulator|auto zast[eę]pcz|odbi[oó]r auta|service|repair|inspection/i

// Zwraca liste brakujacych lokalizacji - lepiej nie wyslac raportu niz wyslac
// niepelny (np. po ukryciu albo odlaczeniu wizytowki).
export function matchLocations(businesses) {
  const locations = SKODA_LOCATIONS.map((loc) => ({
    name: loc.name,
    business: businesses.find((b) => b.google_location_id === loc.googleLocationId),
  }))
  const problems = locations.filter((l) => !l.business).map((l) => `${l.name}: brak wizytowki w bazie`)
  return { locations, problems }
}

// Wszystkie oceny wizytowek, stronicowane (Supabase oddaje max 1000 wierszy).
export async function fetchAllRatings(supabase, businessIds) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('reviews')
      .select('business_id, star_rating')
      .in('business_id', businessIds)
      .gt('star_rating', 0)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error('Blad pobierania ocen: ' + error.message)
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

export async function fetchWeekReviews(supabase, businessIds, now) {
  const since = new Date(now.getTime() - WEEK_MS)
  const { data, error } = await supabase
    .from('reviews')
    .select('id, business_id, star_rating, comment, reviewer_name, create_time')
    .in('business_id', businessIds)
    .gt('star_rating', 0)
    .gte('create_time', since.toISOString())
    .order('create_time', { ascending: false })
  if (error) throw new Error('Blad pobierania opinii z tygodnia: ' + error.message)
  return { since, reviews: data }
}

function average(rows) {
  if (rows.length === 0) return null
  return rows.reduce((sum, r) => sum + r.star_rating, 0) / rows.length
}

function textOf(review) {
  return parseReviewComment(review.comment).original
}

// Najlepsza: najwyzsza ocena (min. 4*), z trescia, najdluzsza. Najslabsza:
// najnizsza ocena, pokazywana gdy jest nizsza od najlepszej albo najlepszej brak
// (przy samych 5* nie ma "najgorszej", a jedyna opinia 1* nie jest "najlepsza").
const MIN_BEST_RATING = 4

function pickBestWorst(reviews) {
  if (reviews.length === 0) return { best: null, worst: null }
  const byText = (a, b) => textOf(b).length - textOf(a).length
  const top = [...reviews].sort((a, b) => b.star_rating - a.star_rating || byText(a, b))[0]
  const bottom = [...reviews].sort((a, b) => a.star_rating - b.star_rating || byText(a, b))[0]
  const best = top.star_rating >= MIN_BEST_RATING ? top : null
  const worst = !best || bottom.star_rating < best.star_rating ? bottom : null
  return { best, worst }
}

async function classifyWithAi(reviews) {
  const list = reviews.map((r) => `[${r.id}] ${textOf(r).slice(0, 1500)}`).join('\n\n')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Poniżej opinie Google o salonach samochodowych Škoda. Każda zaczyna się od identyfikatora w nawiasie kwadratowym.
Wskaż opinie, które dotyczą SERWISU: naprawy, przeglądu, obsługi warsztatu, doradcy serwisowego, części, gwarancji, terminu w serwisie, auta zastępczego. Opinie o zakupie auta, salonie sprzedaży lub handlowcu NIE są serwisowe.
Zwróć wyłącznie tablicę JSON z identyfikatorami opinii serwisowych, np. ["id1","id2"], albo [] gdy żadnej.

${list}`,
      }],
    }),
  })
  if (!res.ok) throw new Error('Anthropic API error: ' + res.status)
  const data = await res.json()
  const ids = JSON.parse(data.content?.[0]?.text?.match(/\[[\s\S]*\]/)?.[0] || 'null')
  if (!Array.isArray(ids)) throw new Error('Niepoprawna odpowiedz klasyfikacji')
  return new Set(ids.map(String))
}

// Zwraca zbior id opinii serwisowych i metode (ai / keywords).
export async function classifyService(reviews) {
  const withText = reviews.filter((r) => textOf(r).length > 0)
  if (withText.length === 0) return { serviceIds: new Set(), method: 'none' }
  try {
    return { serviceIds: await classifyWithAi(withText), method: 'ai' }
  } catch (e) {
    console.error('Klasyfikacja AI nie powiodla sie, uzywam slow kluczowych:', e)
    const ids = withText.filter((r) => SERVICE_KEYWORDS.test(textOf(r))).map((r) => String(r.id))
    return { serviceIds: new Set(ids), method: 'keywords' }
  }
}

export function buildLocationStats(locations, allRatings, weekReviews, serviceIds) {
  return locations.map(({ name, business }) => {
    const all = allRatings.filter((r) => r.business_id === business.id)
    const week = weekReviews.filter((r) => r.business_id === business.id)
    const { best, worst } = pickBestWorst(week)
    return {
      name,
      business,
      totalCount: all.length,
      totalAvg: average(all),
      weekCount: week.length,
      weekAvg: average(week),
      best,
      worst,
      service: week.filter((r) => serviceIds.has(String(r.id)) && textOf(r).length > 0),
    }
  })
}
