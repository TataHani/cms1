// Daty z bazy przychodza bez oznaczenia strefy ("2026-08-12T13:08:14.392"),
// a sa zapisane w UTC - Google zwraca createTime w UTC i sync zapisuje je bez
// konwersji. Goly new Date() bierze taki string za czas lokalny, przez co panel
// pokazywal godzine o 2h wczesniejsza niz rzeczywista (latem).
const TIMEZONE = 'Europe/Warsaw'

export function parseDbDate(value) {
  if (!value) return null

  const raw = String(value).trim().replace(' ', 'T')
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(raw)
  const date = new Date(hasZone ? raw : raw + 'Z')

  return isNaN(date.getTime()) ? null : date
}

// Data z godzina, np. "12.08.2026, 15:08"
export function formatDateTime(value) {
  const date = parseDbDate(value)
  if (!date) return ''

  return date.toLocaleString('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: TIMEZONE,
  })
}

// Sama data, np. "12.08.2026"
export function formatDate(value) {
  const date = parseDbDate(value)
  if (!date) return ''

  return date.toLocaleDateString('pl-PL', { timeZone: TIMEZONE })
}
