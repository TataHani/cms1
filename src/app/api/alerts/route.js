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

  let alerts

  if (user?.role === 'admin') {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    alerts = data
  } else {
    const { data: permissions } = await supabase
      .from('business_permissions')
      .select('business_id')
      .eq('user_id', userId)

    const businessIds = permissions?.map(p => p.business_id) || []

    if (businessIds.length === 0) {
      return Response.json({ alerts: [] })
    }

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .in('business_id', businessIds)
      .order('created_at', { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    alerts = data
  }

  return Response.json({ alerts })
}

export async function DELETE(request) {
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

  // Pobierz business IDs dostępne dla tego użytkownika (tak samo jak w GET)
  let businessIds
  if (user?.role === 'admin') {
    const { data: businesses } = await supabase.from('businesses').select('id')
    businessIds = businesses?.map(b => b.id) || []
  } else {
    const { data: permissions } = await supabase
      .from('business_permissions')
      .select('business_id')
      .eq('user_id', userId)
    businessIds = permissions?.map(p => p.business_id) || []
  }

  if (businessIds.length === 0) return Response.json({ success: true })

  const { searchParams } = new URL(request.url)
  const alertId = searchParams.get('id')

  if (alertId) {
    // Usuń pojedynczy alert — tylko jeśli należy do lokalizacji użytkownika
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', alertId)
      .in('business_id', businessIds)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ success: true })
  }

  // Usuń wszystkie przeczytane alerty z dostępnych lokalizacji
  const { error } = await supabase
    .from('alerts')
    .delete()
    .in('business_id', businessIds)
    .eq('is_read', true)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
