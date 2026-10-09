import { getUserId } from '../../../../lib/session'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function GET() {
  const userId = await getUserId()

  if (!userId) {
    return Response.json({ user: null })
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', userId)
    .single()

  return Response.json({ user })
}
