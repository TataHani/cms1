import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { generateReply } from '../../../../../lib/ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function POST(request, { params }) {
  const userId = cookies().get('user_id')?.value
  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: review } = await supabase
    .from('reviews')
    .select('id, star_rating, comment, business_id, reviewer_name')
    .eq('id', params.id)
    .single()

  if (!review) {
    return Response.json({ error: 'Review not found' }, { status: 404 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('title, phone')
    .eq('id', review.business_id)
    .single()

  if (!business) {
    return Response.json({ error: 'Business not found' }, { status: 404 })
  }

  let suggestion
  try {
    suggestion = await generateReply(review, business)
  } catch (e) {
    return Response.json({ error: 'Nie udalo sie wygenerowac propozycji' }, { status: 502 })
  }

  await supabase
    .from('reviews')
    .update({ suggested_reply: suggestion })
    .eq('id', params.id)

  return Response.json({ suggestion })
}
