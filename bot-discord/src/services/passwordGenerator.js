import { randomBytes } from 'node:crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*'

export function generatePassword(length = 16) {
  const size = Math.min(32, Math.max(12, length))
  const bytes = randomBytes(size)
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}
