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
    return Response.json({ posts: [] })
  }

  const businessIds = businesses.map(b => b.id)

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .in('business_id', businessIds)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ posts })
}

export async function POST(request) {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { business_id, topic_type, summary } = await request.json()

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      business_id,
      topic_type,
      summary,
      state: 'PUBLISHED',
      published_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ post })
}
