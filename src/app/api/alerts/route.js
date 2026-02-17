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
    .select('role')
    .eq('id', userId)
    .single()

  let alerts

  if (user?.role === 'admin') {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    alerts = data
  } else {
    const { data: permissions } = await supabase
      .from('business_permissions')
      .select('business_id')
      .eq('user_id', userId)

    const businessIds = permissions?.map(p => p.business_id) || []

    if (businessIds.length === 0) {
      return Response.json({ alerts: [] })
    }

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .in('business_id', businessIds)
      .order('created_at', { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    alerts = data
  }

  return Response.json({ alerts })
}
