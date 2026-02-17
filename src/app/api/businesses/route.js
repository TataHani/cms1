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
    // User widzi tylko wizytówki do których ma uprawnienia
    const { data: permissions } = await supabase
      .from('business_permissions')
      .select('business_id')
      .eq('user_id', userId)

    if (!permissions || permissions.length === 0) {
      return Response.json({ businesses: [] })
    }

    const businessIds = permissions.map(p => p.business_id)

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .in('id', businessIds)
      .order('title')

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    businesses = data
  }

  return Response.json({ businesses, isAdmin: user?.role === 'admin' })
}
