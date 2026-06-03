import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const TYPE_LABELS = { bug: 'Błąd', remark: 'Uwaga', idea: 'Sugestia' }

export async function POST(request) {
  const userId = cookies().get('user_id')?.value
  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { type, message, screenshot, screenshotName } = await request.json()

  if (!message || !message.trim()) {
    return Response.json({ error: 'Treść zgłoszenia jest wymagana' }, { status: 400 })
  }

  const dest = process.env.FEEDBACK_EMAIL
  if (!dest) {
    return Response.json({ error: 'Brak konfiguracji odbiorcy zgłoszeń' }, { status: 500 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', userId)
    .single()

  const fromLabel = user ? `${user.name || 'Użytkownik'} (${user.email})` : 'nieznany użytkownik'
  const typeLabel = TYPE_LABELS[type] || 'Zgłoszenie'

  const attachments = []
  if (screenshot) {
    // screenshot przychodzi jako dataURL: "data:image/png;base64,XXXX"
    const match = /^data:(.+);base64,(.+)$/.exec(screenshot)
    if (match) {
      attachments.push({
        filename: screenshotName || 'screenshot.png',
        content: match[2],
        encoding: 'base64',
      })
    }
  }

  const html = `
    <h2>${typeLabel} z aplikacji GMB Manager</h2>
    <p><strong>Od:</strong> ${fromLabel}</p>
    <p><strong>Typ:</strong> ${typeLabel}</p>
    <p><strong>Treść:</strong></p>
    <p>${message.replace(/\n/g, '<br>')}</p>
    <p style="color:#888;font-size:12px;">Wysłano ${new Date().toLocaleString('pl-PL')}${attachments.length ? ' (w załączniku zrzut ekranu)' : ''}</p>
  `

  try {
    await sendEmail(dest, `[GMB Feedback] ${typeLabel} od ${user?.email || 'użytkownika'}`, html, attachments)
  } catch (e) {
    console.error('Blad wysylki zgloszenia:', e)
    return Response.json({ error: 'Nie udało się wysłać zgłoszenia' }, { status: 502 })
  }

  return Response.json({ success: true })
}
