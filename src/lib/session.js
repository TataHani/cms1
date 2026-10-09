import crypto from 'crypto'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const COOKIE = 'session'
const MAX_AGE_S = 60 * 60          // hard limit: session dies 1h after login
const IDLE_MS = 15 * 60 * 1000     // session dies after 15 min without requests

// Only the hash is stored, so a leaked sessions table cannot be used to log in
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const now = new Date()

  await supabase.from('sessions').delete().lt('expires_at', now.toISOString())

  const { error } = await supabase.from('sessions').insert({
    token_hash: hashToken(token),
    user_id: userId,
    expires_at: new Date(now.getTime() + MAX_AGE_S * 1000).toISOString()
  })
  if (error) throw new Error(`Session insert failed: ${error.message}`)

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_S
  })
  cookies().delete('user_id')
}

// Returns the logged-in user's id, or null. Every call counts as activity.
export async function getUserId() {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null

  const tokenHash = hashToken(token)
  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, expires_at, last_seen_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!session) return null

  const now = Date.now()
  const expired = new Date(session.expires_at).getTime() <= now
  const idle = now - new Date(session.last_seen_at).getTime() > IDLE_MS
  if (expired || idle) {
    await supabase.from('sessions').delete().eq('token_hash', tokenHash)
    return null
  }

  await supabase
    .from('sessions')
    .update({ last_seen_at: new Date(now).toISOString() })
    .eq('token_hash', tokenHash)

  return session.user_id
}

export async function destroySession() {
  const token = cookies().get(COOKIE)?.value
  if (token) {
    await supabase.from('sessions').delete().eq('token_hash', hashToken(token))
  }
  cookies().delete(COOKIE)
  cookies().delete('user_id')
}
