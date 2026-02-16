import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    redirect('/?error=no_code')
  }

  // Wymień code na tokeny
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenResponse.json()

  if (!tokens.access_token) {
    redirect('/?error=token_failed')
  }

  // Pobierz dane użytkownika
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  const googleUser = await userResponse.json()

  // Zapisz lub zaktualizuj użytkownika w bazie
  const { data: user, error } = await supabase
    .from('users')
    .upsert({
      email: googleUser.email,
      name: googleUser.name,
      avatar_url: googleUser.picture,
      google_id: googleUser.id,
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'google_id',
    })
    .select()
    .single()

  if (error) {
    console.error('Database error:', error)
    redirect('/?error=db_error')
  }

  // Ustaw cookie z ID użytkownika
  cookies().set('user_id', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 dni
  })

  redirect('/')
}
