import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET() {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) return Response.json({ count: 0 })

  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (user?.role === 'admin') {
    const { count } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
    return Response.json({ count: count || 0 })
  }

  const { data: permissions } = await supabase
    .from('business_permissions')
    .select('business_id')
    .eq('user_id', userId)

  const businessIds = permissions?.map(p => p.business_id) || []
  if (businessIds.length === 0) return Response.json({ count: 0 })

  const { count } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)
    .in('business_id', businessIds)

  return Response.json({ count: count || 0 })
}
