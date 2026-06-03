import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request) {
  const { token, password } = await request.json()

  if (!token || !password) {
    return Response.json({ error: 'Brak tokenu lub hasla' }, { status: 400 })
  }

  if (password.length < 6) {
    return Response.json({ error: 'Haslo musi miec minimum 6 znakow' }, { status: 400 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, reset_token_expires')
    .eq('reset_token', token)
    .single()

  if (!user) {
    return Response.json({ error: 'Link jest nieprawidlowy' }, { status: 400 })
  }

  if (new Date(user.reset_token_expires) < new Date()) {
    return Response.json({ error: 'Link wygasl. Wyslij prosbe o reset ponownie.' }, { status: 400 })
  }

  await supabase
    .from('users')
    .update({
      password_hash: hashPassword(password),
      reset_token: null,
      reset_token_expires: null,
    })
    .eq('id', user.id)

  return Response.json({ success: true })
}
