import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET() {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    redirect('/login')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI_CONNECT || process.env.GOOGLE_REDIRECT_URI.replace('/callback/google', '/callback/google-connect')

  const scope = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/business.manage'
  ].join(' ')

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    'client_id=' + clientId +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(scope) +
    '&access_type=offline' +
    '&prompt=consent'

  redirect(authUrl)
}
