import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function DELETE(request, { params }) {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Usuń wizytówki powiązane z tym połączeniem
  await supabase
    .from('businesses')
    .delete()
    .eq('google_connection_id', params.id)

  // Usuń połączenie
  const { error } = await supabase
    .from('google_connections')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
