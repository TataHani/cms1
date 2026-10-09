import { createSession } from '../../../../lib/session'
import { hashPassword } from '../../../../lib/password'
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

  if (password.length < 6) {
    return Response.json({ error: 'Haslo musi miec minimum 6 znakow' }, { status: 400 })
  }

  // Sprawdź czy email już istnieje
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    return Response.json({ error: 'Ten email jest juz zarejestrowany' }, { status: 400 })
  }

  // Utwórz użytkownika
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: hashPassword(password),
      role: 'user'
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: 'Blad tworzenia konta' }, { status: 500 })
  }

  // Zaloguj użytkownika
  await createSession(user.id)

  return Response.json({ success: true, user: { id: user.id, email: user.email } })
}
