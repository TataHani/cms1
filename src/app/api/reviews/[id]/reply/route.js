import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function POST(request, { params }) {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { reply } = await request.json()

  if (!reply || !reply.trim()) {
    return Response.json({ error: 'Reply is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('reviews')
    .update({ 
      has_reply: true, 
      reply_comment: reply.trim()
    })
    .eq('id', params.id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
