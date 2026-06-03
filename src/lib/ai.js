// Generowanie odpowiedzi na opinie Google przez Claude API.
const MODEL = 'claude-haiku-4-5-20251001'

function buildPrompt(review, business) {
  const isNegative = review.star_rating === 1 || review.star_rating === 2
  const hasText = review.comment && review.comment.trim().length > 0
  const contact = business.phone ? ` Numer kontaktowy firmy: ${business.phone}.` : ''

  if (isNegative) {
    return `Napisz krotka (2-3 zdania) odpowiedz na negatywna opinie (${review.star_rating}/5) wystawiona firmie "${business.title}".
Tresc opinii: "${review.comment || '(brak tresci, sama ocena)'}"
Zasady: przepros za nieprzyjemne doswiadczenie, okaz empatie, zaproponuj kontakt w celu wyjasnienia sprawy. NIE przyznawaj sie do konkretnych win, NIE wdawaj sie w polemike, nie obiecuj rekompensaty.${contact} Ton uprzejmy i profesjonalny. Zakoncz podpisem "Zespol ${business.title}".`
  }

  if (hasText) {
    return `Napisz krotkie (1-2 zdania) cieple podziekowanie za pozytywna opinie (${review.star_rating}/5) wystawiona firmie "${business.title}".
Tresc opinii: "${review.comment}"
Ton serdeczny i profesjonalny, bez przesady. Zakoncz podpisem "Zespol ${business.title}".`
  }

  return `Napisz bardzo krotkie (1 zdanie) uprzejme podziekowanie za ocene ${review.star_rating}/5 wystawiona firmie "${business.title}" (klient nie dodal tresci). Zakoncz podpisem "Zespol ${business.title}".`
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
      system: 'Jestes asystentem odpowiadajacym na opinie Google w imieniu firmy. Piszesz wylacznie po polsku, naturalnie i konkretnie. Zwracasz sam tekst odpowiedzi, bez komentarzy od siebie i bez cudzyslowow.',
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
