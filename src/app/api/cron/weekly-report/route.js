import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../../lib/email'
import { formatDate } from '../../../../lib/dates'
import { parseReviewComment } from '../../../../lib/reviewText'
import {
  matchLocations, fetchAllRatings, fetchWeekReviews, classifyService, buildLocationStats,
} from '../../../../lib/weeklyReport'
import {
  renderLocationCard, renderSummaryCard, renderReviewCard, formatRating, opinionsLabel,
} from '../../../../lib/reportImages'

// Cotygodniowy raport opinii Skody dla Dyrektora Serwisu.
// Wywolywany z cron-job.org w niedziele o 12:00 (Europe/Warsaw).
// ?dry=1 zwraca same dane w JSON, bez grafik i bez wysylki.

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function slug(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function reviewHtml(review, label) {
  const text = parseReviewComment(review.comment).original || '(opinia bez treści, sama ocena)'
  return `<div style="margin:8px 0;padding:10px 14px;background:#F2F5F3;border-left:4px solid #78FAAE;font-family:Arial,sans-serif;font-size:14px;color:#0E3A2F">
    <div style="font-size:12px;color:#5F7A70;font-weight:bold">${label} · ${review.star_rating}/5 · ${escapeHtml(review.reviewer_name || 'Anonim')} · ${formatDate(review.create_time)}</div>
    <div style="margin-top:4px">${escapeHtml(text)}</div>
  </div>`
}

function locationHtml(stat, cid) {
  const reviews = [
    stat.best && reviewHtml(stat.best, 'Najlepsza opinia'),
    stat.worst && reviewHtml(stat.worst, 'Najsłabsza opinia'),
    ...stat.service.map((r) => reviewHtml(r, 'Opinia o serwisie')),
  ].filter(Boolean).join('')

  return `<h2 style="font-family:Arial,sans-serif;color:#0E3A2F;margin:28px 0 8px">${stat.name}</h2>
  <table style="font-family:Arial,sans-serif;font-size:14px;color:#0E3A2F;border-collapse:collapse">
    <tr><td style="padding:2px 16px 2px 0">Średnia ocena łącznie</td><td><b>${formatRating(stat.totalAvg)}</b> (${opinionsLabel(stat.totalCount)})</td></tr>
    <tr><td style="padding:2px 16px 2px 0">Średnia z ostatnich 7 dni</td><td><b>${formatRating(stat.weekAvg)}</b> (${opinionsLabel(stat.weekCount)})</td></tr>
  </table>
  <img src="cid:${cid}" width="560" style="display:block;margin:12px 0;border:1px solid #ddd" alt="${stat.name}">
  ${reviews || '<p style="font-family:Arial,sans-serif;font-size:14px;color:#5F7A70">Brak nowych opinii w tym tygodniu.</p>'}
  ${stat.service.length === 0 && stat.weekCount > 0 ? '<p style="font-family:Arial,sans-serif;font-size:13px;color:#5F7A70">Brak opinii dotyczących serwisu.</p>' : ''}`
}

export async function GET(request) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(request.url).searchParams.get('dry') === '1'
  const recipient = process.env.WEEKLY_REPORT_EMAIL
  if (!dryRun && !recipient) {
    return Response.json({ error: 'Brak zmiennej WEEKLY_REPORT_EMAIL' }, { status: 500 })
  }

  const { data: businesses, error } = await supabase
    .from('businesses').select('*').eq('hidden', false)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { locations, problems } = matchLocations(businesses)
  if (problems.length > 0) {
    console.error('Raport tygodniowy wstrzymany:', problems)
    return Response.json({ error: 'Brak wizytowek w bazie', problems }, { status: 500 })
  }

  const now = new Date()
  const ids = locations.map((l) => l.business.id)
  const allRatings = await fetchAllRatings(supabase, ids)
  const { since, reviews: weekReviews } = await fetchWeekReviews(supabase, ids, now)
  const { serviceIds, method } = await classifyService(weekReviews)
  const stats = buildLocationStats(locations, allRatings, weekReviews, serviceIds)

  const period = `${formatDate(since.toISOString())} - ${formatDate(now.toISOString())}`
  const periodLabel = `Ostatnie 7 dni: ${period}`

  if (dryRun) {
    return Response.json({
      period, serviceMethod: method,
      locations: stats.map((s) => ({
        name: s.name, business: s.business.title,
        totalAvg: s.totalAvg, totalCount: s.totalCount, weekAvg: s.weekAvg, weekCount: s.weekCount,
        best: s.best?.id ?? null, worst: s.worst?.id ?? null, service: s.service.map((r) => r.id),
      })),
    })
  }

  const files = [{ filename: '00-podsumowanie.png', content: await renderSummaryCard(stats, periodLabel) }]
  const inline = [{ filename: '00-podsumowanie.png', content: files[0].content, cid: 'summary' }]

  for (const [i, stat] of stats.entries()) {
    const prefix = `${String(i + 1).padStart(2, '0')}-${slug(stat.name)}`
    const card = await renderLocationCard(stat, periodLabel)
    files.push({ filename: `${prefix}-podsumowanie.png`, content: card })
    inline.push({ filename: `${prefix}-podsumowanie.png`, content: card, cid: `loc${i}` })

    if (stat.best) files.push({ filename: `${prefix}-najlepsza.png`, content: await renderReviewCard(stat.best, stat.name, 'Najlepsza opinia tygodnia') })
    if (stat.worst) files.push({ filename: `${prefix}-najslabsza.png`, content: await renderReviewCard(stat.worst, stat.name, 'Najsłabsza opinia tygodnia') })
    for (const [j, review] of stat.service.entries()) {
      files.push({ filename: `${prefix}-serwis-${j + 1}.png`, content: await renderReviewCard(review, stat.name, 'Opinia o serwisie') })
    }
  }

  const methodNote = method === 'keywords'
    ? '<p style="font-family:Arial,sans-serif;font-size:12px;color:#B00020">Uwaga: opinie serwisowe wybrane po słowach kluczowych (AI niedostępne), lista może być niepełna.</p>'
    : ''

  const html = `<div style="max-width:640px">
  <h1 style="font-family:Arial,sans-serif;color:#0E3A2F;font-size:22px">Opinie Google Škoda: podsumowanie tygodnia</h1>
  <p style="font-family:Arial,sans-serif;font-size:14px;color:#0E3A2F">${periodLabel}. Wszystkie grafiki (format slajdu 16:9) są w załącznikach, gotowe do wklejenia w prezentację.</p>
  ${methodNote}
  <img src="cid:summary" width="560" style="display:block;margin:12px 0;border:1px solid #ddd" alt="Podsumowanie">
  ${stats.map((s, i) => locationHtml(s, `loc${i}`)).join('')}
  </div>`

  await sendEmail(recipient, `Opinie Google Škoda - podsumowanie tygodnia ${period}`, html, [...inline, ...files])

  return Response.json({ sent: true, recipient, period, serviceMethod: method, images: files.length })
}
