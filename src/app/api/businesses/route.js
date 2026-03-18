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

  // Sprawdź rolę użytkownika
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  // Sprawdź czy user ma połączone konto Google
  const { data: googleConnection } = await supabase
    .from('google_connections')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  const hasGoogleConnection = !!googleConnection

  let businesses

  if (user?.role === 'admin') {
    // Admin widzi wszystkie wizytówki
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .order('title')

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    businesses = data
  } else {
    // User widzi własne wizytówki (z jego konta Google) + te do których ma uprawnienia
    const [ownResult, permResult] = await Promise.all([
      supabase.from('businesses').select('*').eq('user_id', userId),
      supabase.from('business_permissions').select('business_id').eq('user_id', userId)
    ])

    const ownIds = new Set((ownResult.data || []).map(b => b.id))
    const permIds = (permResult.data || []).map(p => p.business_id).filter(id => !ownIds.has(id))

    let permBusinesses = []
    if (permIds.length > 0) {
      const { data } = await supabase.from('businesses').select('*').in('id', permIds)
      permBusinesses = data || []
    }

    businesses = [...(ownResult.data || []), ...permBusinesses]
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  return Response.json({ businesses, isAdmin: user?.role === 'admin', hasGoogleConnection })
}
