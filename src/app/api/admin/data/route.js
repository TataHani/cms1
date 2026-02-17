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

  if (user?.role !== 'admin') {
    return Response.json({ error: 'Not authorized' }, { status: 403 })
  }

  const [usersRes, businessesRes, permissionsRes] = await Promise.all([
    supabase.from('users').select('*').order('created_at'),
    supabase.from('businesses').select('*').order('title'),
    supabase.from('business_permissions').select('*')
  ])

  return Response.json({
    users: usersRes.data || [],
    businesses: businessesRes.data || [],
    permissions: permissionsRes.data || []
  })
}
