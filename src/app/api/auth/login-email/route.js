import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function hashPassword(password) {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return Response.json({ error: 'Email i haslo sa wymagane' }, { status: 400 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('password_hash', hashPassword(password))
    .single()

  if (!user) {
    return Response.json({ error: 'Bledny email lub haslo' }, { status: 401 })
  }

  cookies().set('user_id', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30
  })

  return Response.json({ success: true, user: { id: user.id, email: user.email } })
}
