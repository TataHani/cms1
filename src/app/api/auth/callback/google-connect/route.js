import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET(request) {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    redirect('/login')
  }

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    redirect('/settings?error=no_code')
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI_CONNECT || process.env.GOOGLE_REDIRECT_URI.replace('/callback/google', '/callback/google-connect')

  // Wymień code na tokeny
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenResponse.json()

  if (!tokens.access_token) {
    redirect('/settings?error=token_failed')
  }

  // Pobierz dane użytkownika Google
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: 'Bearer ' + tokens.access_token },
  })

  const googleUser = await userResponse.json()

  // Zapisz połączenie
  const { data: connection, error } = await supabase
    .from('google_connections')
    .upsert({
      user_id: userId,
      google_id: googleUser.id,
      google_email: googleUser.email,
      google_name: googleUser.name,
      google_avatar: googleUser.picture,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, {
      onConflict: 'user_id,google_id'
    })
    .select()
    .single()

  if (error) {
    console.error('Database error:', error)
    redirect('/settings?error=db_error')
  }

  redirect('/settings?success=connected')
}
