import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { sendEmail } from '../../../../lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function POST(request) {
  const { email } = await request.json()

  if (!email) {
    return Response.json({ error: 'Email jest wymagany' }, { status: 400 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  // Jesli user istnieje, generujemy token i wysylamy mail.
  // Odpowiedz jest zawsze taka sama, zeby nie zdradzac czy email jest w bazie.
  if (user) {
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await supabase
      .from('users')
      .update({ reset_token: token, reset_token_expires: expires })
      .eq('id', user.id)

    const resetUrl = new URL(request.url).origin + '/reset-password?token=' + token

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <h2>Reset hasła GMB Manager</h2>
        <p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta.</p>
        <p>Kliknij poniższy przycisk, aby ustawić nowe hasło. Link jest ważny przez 1 godzinę.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #10b981; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Ustaw nowe hasło</a>
        </p>
        <p style="color: #64748b; font-size: 13px;">Jeśli to nie Ty wysłałeś tę prośbę, zignoruj tę wiadomość. Hasło nie zostanie zmienione.</p>
      </div>
    `

    try {
      await sendEmail(email, 'Reset hasła - GMB Manager', html)
    } catch (e) {
      console.error('Blad wysylki maila resetu:', e)
    }
  }

  return Response.json({ success: true })
}
