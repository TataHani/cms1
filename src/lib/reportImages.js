// Grafiki PNG 1920x1080 (slajd 16:9) do raportu tygodniowego Skody.
import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'
import { parseReviewComment } from './reviewText'
import { formatDate } from './dates'

const WIDTH = 1920
const HEIGHT = 1080

const DARK = '#0E3A2F'
const GREEN = '#78FAAE'
const LIGHT = '#F2F5F3'
const MUTED = '#5F7A70'
const STAR_OFF = '#C9D3CE'

// Domyslny font generatora nie ma polskich znakow, wiec ladujemy Noto Sans.
let fontsPromise
function loadFonts() {
  const dir = path.join(process.cwd(), 'src', 'fonts')
  fontsPromise ??= Promise.all([
    readFile(path.join(dir, 'NotoSans-Regular.ttf')),
    readFile(path.join(dir, 'NotoSans-Bold.ttf')),
  ]).then(([regular, bold]) => [
    { name: 'Noto Sans', data: regular, weight: 400, style: 'normal' },
    { name: 'Noto Sans', data: bold, weight: 700, style: 'normal' },
  ])
  return fontsPromise
}

async function render(element) {
  const response = new ImageResponse(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: await loadFonts(),
  })
  return Buffer.from(await response.arrayBuffer())
}

// Emoji nie ma w foncie - na grafice zamienilyby sie w puste kwadraty.
function stripEmoji(text) {
  return text.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu, '').replace(/\s{2,}/g, ' ').trim()
}

export function formatRating(value) {
  return value === null ? '-' : value.toFixed(2).replace('.', ',')
}

function Star({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill={color} d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7.3L12 17.8 5.8 21.5l1.6-7.3L2 9.5l7.1-.6z" />
    </svg>
  )
}

function Stars({ rating, size }) {
  return (
    <div style={{ display: 'flex', gap: size * 0.15 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={i <= Math.round(rating) ? GREEN : STAR_OFF} />
      ))}
    </div>
  )
}

function Header({ title, subtitle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: DARK, color: 'white', padding: '44px 96px' }}>
      <div style={{ display: 'flex', fontSize: 34, color: GREEN, fontWeight: 700 }}>ŠKODA PLICHTA · OPINIE GOOGLE</div>
      <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, marginTop: 8 }}>{title}</div>
      <div style={{ display: 'flex', fontSize: 34, opacity: 0.8, marginTop: 8 }}>{subtitle}</div>
    </div>
  )
}

function Tile({ label, value, rating, note }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'white', borderRadius: 32, padding: '48px 64px' }}>
      <div style={{ display: 'flex', fontSize: 40, color: MUTED }}>{label}</div>
      <div style={{ display: 'flex', fontSize: 200, fontWeight: 700, color: DARK, lineHeight: 1.1 }}>{value}</div>
      {rating !== null && <Stars rating={rating} size={72} />}
      <div style={{ display: 'flex', fontSize: 38, color: MUTED, marginTop: 28 }}>{note}</div>
    </div>
  )
}

export function opinionsLabel(count) {
  if (count === 1) return '1 opinia'
  const lastTwo = count % 100
  const last = count % 10
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} opinie`
  return `${count} opinii`
}

export function renderLocationCard(stat, periodLabel) {
  return render(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: LIGHT, fontFamily: 'Noto Sans' }}>
      <Header title={stat.name} subtitle={periodLabel} />
      <div style={{ display: 'flex', flex: 1, gap: 56, padding: '64px 96px' }}>
        <Tile label="Średnia ocena (łącznie)" value={formatRating(stat.totalAvg)} rating={stat.totalAvg} note={`na podstawie ${opinionsLabel(stat.totalCount)}`} />
        <Tile label="Średnia z ostatnich 7 dni" value={formatRating(stat.weekAvg)} rating={stat.weekAvg} note={stat.weekCount ? opinionsLabel(stat.weekCount) : 'brak nowych opinii'} />
      </div>
    </div>
  )
}

export function renderSummaryCard(stats, periodLabel) {
  return render(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: LIGHT, fontFamily: 'Noto Sans' }}>
      <Header title="Podsumowanie lokalizacji" subtitle={periodLabel} />
      <div style={{ display: 'flex', flexDirection: 'column', padding: '32px 96px', flex: 1 }}>
        <div style={{ display: 'flex', fontSize: 32, color: MUTED, padding: '0 32px 16px' }}>
          <div style={{ display: 'flex', flex: 2 }}>Lokalizacja</div>
          <div style={{ display: 'flex', flex: 1 }}>Średnia łącznie</div>
          <div style={{ display: 'flex', flex: 1 }}>Średnia 7 dni</div>
          <div style={{ display: 'flex', flex: 1 }}>Opinie 7 dni</div>
        </div>
        {stats.map((s) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 20, padding: '12px 32px', marginBottom: 12, fontSize: 40, color: DARK }}>
            <div style={{ display: 'flex', flex: 2, fontWeight: 700 }}>{s.name}</div>
            <div style={{ display: 'flex', flex: 1, fontWeight: 700 }}>{formatRating(s.totalAvg)}</div>
            <div style={{ display: 'flex', flex: 1 }}>{formatRating(s.weekAvg)}</div>
            <div style={{ display: 'flex', flex: 1 }}>{s.weekCount}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Rozmiar fontu dobierany do dlugosci tresci, zeby opinia zmiescila sie na slajdzie.
function quoteFontSize(length) {
  if (length < 150) return 64
  if (length < 350) return 52
  if (length < 650) return 42
  if (length < 1000) return 34
  return 28
}

const MAX_QUOTE = 1400

export function renderReviewCard(review, locationName, label) {
  const { original, translation } = parseReviewComment(review.comment)
  let text = stripEmoji(original) || '(opinia bez treści, sama ocena)'
  if (text.length > MAX_QUOTE) text = text.slice(0, MAX_QUOTE).replace(/\s+\S*$/, '') + '…'
  const fontSize = quoteFontSize(text.length)

  return render(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: LIGHT, fontFamily: 'Noto Sans' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: DARK, color: 'white', padding: '40px 96px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 32, color: GREEN, fontWeight: 700 }}>{label.toUpperCase()}</div>
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 700 }}>Škoda Plichta {locationName}</div>
        </div>
        <Stars rating={review.star_rating} size={64} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, margin: '56px 96px', background: 'white', borderRadius: 32, padding: '56px 72px' }}>
        <div style={{ display: 'flex', flex: 1, fontSize, color: DARK, lineHeight: 1.35 }}>{text}</div>
        {translation && <div style={{ display: 'flex', fontSize: 28, color: MUTED, marginTop: 16 }}>{`Tłumaczenie Google: ${stripEmoji(translation).slice(0, 400)}`}</div>}
        <div style={{ display: 'flex', fontSize: 36, color: MUTED, marginTop: 24 }}>
          {`${review.reviewer_name || 'Anonim'} · ${formatDate(review.create_time)} · ${review.star_rating}/5`}
        </div>
      </div>
    </div>
  )
}
