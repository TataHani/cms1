import { createSession } from '../../../../lib/session'
import { verifyPassword, isLegacyHash, hashPassword } from '../../../../lib/password'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function POST(request) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return Response.json({ error: 'Email i haslo sa wymagane' }, { status: 400 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, email, password_hash')
    .eq('email', email)
    .single()

  if (!user || !verifyPassword(password, user.password_hash)) {
    return Response.json({ error: 'Bledny email lub haslo' }, { status: 401 })
  }

  if (isLegacyHash(user.password_hash)) {
    await supabase
      .from('users')
      .update({ password_hash: hashPassword(password) })
      .eq('id', user.id)
  }

  await createSession(user.id)

  return Response.json({ success: true, user: { id: user.id, email: user.email } })
}
