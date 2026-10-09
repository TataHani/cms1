import crypto from 'crypto'

const KEY_LENGTH = 64
const PREFIX = 'scrypt$'

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${PREFIX}${salt}$${hash}`
}

// Old accounts still hold an unsalted sha256 hash; it is accepted here
// and the login route upgrades it to scrypt right after a successful match
export function verifyPassword(password, stored) {
  if (!stored) return false
  if (isLegacyHash(stored)) {
    return safeEqual(crypto.createHash('sha256').update(password).digest('hex'), stored)
  }
  const [, salt, hash] = stored.split('$')
  return safeEqual(crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex'), hash)
}

export const isLegacyHash = (stored) => !stored.startsWith(PREFIX)

function safeEqual(a, b) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}
