// Kto dostaje maile o negatywnych opiniach dla danej wizytowki.
// Uzywane przez oba crony: sync-reviews (alert natychmiastowy)
// i auto-respond (ponaglenie przed auto-publikacja).
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Wlasciciel wizytowki + wszyscy z nadanym dostepem + admini.
export async function getRecipients(business) {
  const emails = new Set()

  const { data: owner } = await supabase
    .from('users').select('email').eq('id', business.user_id).single()
  if (owner?.email) emails.add(owner.email)

  const { data: perms } = await supabase
    .from('business_permissions').select('user_id').eq('business_id', business.id)
  if (perms && perms.length > 0) {
    const { data: permUsers } = await supabase
      .from('users').select('email').in('id', perms.map(p => p.user_id))
    permUsers?.forEach(u => u.email && emails.add(u.email))
  }

  const { data: admins } = await supabase
    .from('users').select('email').eq('role', 'admin')
  admins?.forEach(a => a.email && emails.add(a.email))

  return [...emails]
}
