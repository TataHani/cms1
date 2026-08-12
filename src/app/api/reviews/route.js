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
      .eq('hidden', false)
    businessIds = businesses?.map(b => b.id) || []
  } else {
    const [ownResult, permResult] = await Promise.all([
      supabase.from('businesses').select('id').eq('user_id', userId).eq('hidden', false),
      supabase.from('business_permissions').select('business_id').eq('user_id', userId)
    ])

    const ownIds = (ownResult.data || []).map(b => b.id)
    const permIds = (permResult.data || []).map(p => p.business_id)
    businessIds = [...new Set([...ownIds, ...permIds])]
  }

  // Uprawnienia moga wskazywac na ukryta wizytowke - odfiltruj ja
  if (businessIds.length > 0) {
    const { data: visible } = await supabase
      .from('businesses')
      .select('id')
      .in('id', businessIds)
      .eq('hidden', false)
    businessIds = (visible || []).map(b => b.id)
  }

  if (businessIds.length === 0) {
    return Response.json({ reviews: [] })
  }

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, business_id, reviewer_name, star_rating, comment, has_reply, reply_comment, reply_update_time, is_new, is_edited, create_time, suggested_reply')
    .in('business_id', businessIds)
    .order('create_time', { ascending: false })
    .limit(50000)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ reviews })
}
