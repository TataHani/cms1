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

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', userId)

  if (!businesses || businesses.length === 0) {
    return Response.json({ competitors: [] })
  }

  const businessIds = businesses.map(b => b.id)

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
