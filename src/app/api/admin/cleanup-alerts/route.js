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
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Usuń alerty NEW_REVIEW utworzone w ciągu ostatnich 24h
  // (wszystkie wygenerowane przez błędny bulk import)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: toDelete } = await supabase
    .from('alerts')
    .select('id')
    .eq('alert_type', 'NEW_REVIEW')
    .gte('created_at', cutoff)

  const count = toDelete?.length || 0

  const { error } = await supabase
    .from('alerts')
    .delete()
    .eq('alert_type', 'NEW_REVIEW')
    .gte('created_at', cutoff)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, deleted: count })
}
