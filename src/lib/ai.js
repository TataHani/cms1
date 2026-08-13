// Generowanie odpowiedzi na opinie Google przez Claude API.
import { parseReviewComment } from './reviewText'

const MODEL = 'claude-sonnet-4-6'

// Podpis ma zawierac sama marke, a nie pelna nazwe wizytowki
// ("Zespol Audi", nie "Zespol Audi Gdansk Stadion").
const BRANDS = [
  [/volkswagen|\bvw\b/i, 'Volkswagen'],
  [/audi/i, 'Audi'],
  [/ford/i, 'Ford'],
]

export function brandName(title) {
  const match = BRANDS.find(([pattern]) => pattern.test(title || ''))
  return match ? match[1] : (title || 'Plichta')
}

// Kazda odpowiedz konczy sie tym samym podpisem, w dwoch liniach.
function signatureRule(brand) {
  return `Zakończ odpowiedź dokładnie takim podpisem, w dwóch osobnych liniach:
Z wyrazami szacunku,
Zespół ${brand}
Nie dopisuj nic po podpisie. Gdy odpowiadasz w innym języku niż polski, przetłumacz zwrot grzecznościowy i słowo "Zespół" na ten język, ale nazwę "${brand}" zostaw bez zmian.`
}

function buildPrompt(review, business) {
  const brand = brandName(business.title)
  // Google sklejaja oryginal z tlumaczeniem - bierzemy sam oryginal,
  // zeby model odpowiedzial w jezyku klienta, a nie mieszal jezykow.
  const { original } = parseReviewComment(review.comment)
  const isNegative = review.star_rating === 1 || review.star_rating === 2
  const hasText = original.length > 0
  const contact = business.phone ? ` Numer kontaktowy firmy: ${business.phone}.` : ''
  const author = `Autor opinii: ${review.reviewer_name || 'nieznany'}.`

  if (isNegative) {
    return `Napisz krótką (2-3 zdania) odpowiedź na negatywną opinię (${review.star_rating}/5) wystawioną firmie "${business.title}".
Oryginalna treść opinii: "${original || '(brak treści, sama ocena)'}"
${author}
Odpowiedz w tym samym języku, w którym napisana jest opinia.
Zasady: przeproś za nieprzyjemne doświadczenie, okaż empatię, zaproponuj kontakt w celu wyjaśnienia sprawy. Nie przyznawaj się do konkretnych win, nie wdawaj się w polemikę, nie obiecuj rekompensaty.${contact} Ton uprzejmy i profesjonalny.
${signatureRule(brand)}`
  }

  if (hasText) {
    return `Napisz krótkie (1-2 zdania) ciepłe podziękowanie za pozytywną opinię (${review.star_rating}/5) wystawioną firmie "${business.title}".
Oryginalna treść opinii: "${original}"
${author}
Odpowiedz w tym samym języku, w którym napisana jest opinia.
Ton serdeczny i profesjonalny, bez przesady.
${signatureRule(brand)}`
  }

  return `Napisz bardzo krótkie (1 zdanie) uprzejme podziękowanie za ocenę ${review.star_rating}/5 wystawioną firmie "${business.title}" (klient nie dodał treści).
${author}
${signatureRule(brand)}`
}

export async function generateReply(review, business) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: 'Jesteś asystentem odpowiadającym na opinie Google w imieniu firmy. Piszesz naturalnie, poprawną polszczyzną z właściwą odmianą wyrazów i interpunkcją (gdy opinia jest po polsku), w tym samym języku, w którym napisana jest opinia klienta. Zachowuj pełną poprawność gramatyczną i fleksyjną. Formę grzecznościową dobierz do płci autora wynikającej z jego imienia (np. "Pana" dla mężczyzny, "Pani" dla kobiety, z poprawną odmianą); jeśli płci nie da się jednoznacznie ustalić z imienia, pisz neutralnie i nie używaj konstrukcji "Pan/Pani" ani ukośnika. Nie używaj znaku myślnika "–" ani "—"; zamiast nich używaj przecinka lub kropki (zwykły łącznik "-" jest dozwolony). Zwracasz sam tekst odpowiedzi, bez komentarzy od siebie i bez cudzysłowów.',
      messages: [{ role: 'user', content: buildPrompt(review, business) }],
    }),
  })

  if (!res.ok) {
    throw new Error('Anthropic API error: ' + res.status)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text?.trim()
  if (!text) throw new Error('Pusta odpowiedz z API')
  return text
}
