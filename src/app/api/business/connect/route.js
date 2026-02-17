import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET() {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('google_access_token')
    .eq('id', userId)
    .single()

  if (!user?.google_access_token) {
    return Response.json({ error: 'No Google token' }, { status: 401 })
  }

  try {
    const accountsResponse = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: {
          'Authorization': 'Bearer ' + user.google_access_token
        }
      }
    )

    const accountsData = await accountsResponse.json()

    // Pokaż surową odpowiedź z API
    return Response.json({
      debug: true,
      status: accountsResponse.status,
      apiResponse: accountsData,
      tokenPreview: user.google_access_token.substring(0, 20) + '...'
    })

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
