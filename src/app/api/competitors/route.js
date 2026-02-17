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

  let businessIds

  if (user?.role === 'admin') {
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
    businessIds = businesses?.map(b => b.id) || []
  } else {
    const { data: permissions } = await supabase
      .from('business_permissions')
      .select('business_id')
      .eq('user_id', userId)
    businessIds = permissions?.map(p => p.business_id) || []
  }

  if (businessIds.length === 0) {
    return Response.json({ competitors: [] })
  }

  const { data: competitors, error } = await supabase
    .from('competitors')
    .select('*')
    .in('business_id', businessIds)
    .order('average_rating', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ competitors })
}
