// Google Business Profile sklejka przetlumaczonych opinii w jednym polu.
// Dwa spotykane formaty:
//   A: "<oryginal> (Translated by Google) <tlumaczenie>"
//   B: "(Translated by Google) <tlumaczenie> (Original) <oryginal>"
// Zwraca rozdzielony oryginal i tlumaczenie.
export function parseReviewComment(comment) {
  if (!comment) return { original: '', translation: '' }

  const transMarker = '(Translated by Google)'
  const origMarker = '(Original)'

  if (comment.includes(origMarker)) {
    const oi = comment.indexOf(origMarker)
    const original = comment.slice(oi + origMarker.length).trim()
    const translation = comment.slice(0, oi).replace(transMarker, '').trim()
    return { original, translation }
  }

  if (comment.includes(transMarker)) {
    const ti = comment.indexOf(transMarker)
    const original = comment.slice(0, ti).trim()
    const translation = comment.slice(ti + transMarker.length).trim()
    return { original, translation }
  }

  return { original: comment.trim(), translation: '' }
}
