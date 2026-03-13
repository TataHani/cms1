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

  const { data: settings, error } = await supabase
    .from('alert_settings')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ settings })
}

export async function POST(request) {
  const cookieStore = cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { settings } = await request.json()

  for (const setting of settings) {
    if (setting.is_new) {
      await supabase.from('alert_settings').insert({
        user_id: userId,
        business_id: setting.business_id || null,
        email_enabled: true,
        email_address: setting.email_address,
        min_stars: setting.min_stars,
        max_stars: setting.max_stars
      })
    } else {
      await supabase.from('alert_settings')
        .update({
          business_id: setting.business_id || null,
          email_address: setting.email_address,
          min_stars: setting.min_stars,
          max_stars: setting.max_stars
        })
        .eq('id', setting.id)
        .eq('user_id', userId)
    }
  }

  return Response.json({ success: true })
}
