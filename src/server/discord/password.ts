import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_PREFIX = 'scrypt'
const SCRYPT_KEYLEN = 64

function normalizeSecret(value: string) {
  return value.trim()
}

export function hashSecret(plainSecret: string) {
  const normalized = normalizeSecret(plainSecret)
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(normalized, salt, SCRYPT_KEYLEN).toString('hex')
  return `${SCRYPT_PREFIX}$${salt}$${hash}`
}

export function verifySecret(plainSecret: string, storedHash: string | null | undefined) {
  if (!storedHash) return false
  const [prefix, salt, expected] = storedHash.split('$')
  if (prefix !== SCRYPT_PREFIX || !salt || !expected) return false

  const candidate = scryptSync(normalizeSecret(plainSecret), salt, SCRYPT_KEYLEN).toString('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  const candidateBuffer = Buffer.from(candidate, 'hex')

  if (expectedBuffer.length !== candidateBuffer.length) return false
  return timingSafeEqual(expectedBuffer, candidateBuffer)
}

const USERNAME_ALLOWED = /[^a-z0-9]+/g

function sanitizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(USERNAME_ALLOWED, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildUsernameCandidate(rpFirstName: string, rpPhoneNumber: string, discriminator: string) {
  const namePart = sanitizeName(rpFirstName).slice(0, 14) || 'membre'
  const phonePart = rpPhoneNumber.replace(/\D+/g, '').slice(-4)
  const discordPart = discriminator.replace(/\D+/g, '').slice(-4)
  const suffix = phonePart || discordPart || randomBytes(2).toString('hex')
  return `${namePart}-${suffix}`.slice(0, 24)
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'

export function generateSecurePassword(length = 16) {
  const targetLength = Math.min(32, Math.max(12, length))
  const bytes = randomBytes(targetLength)
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join('')
}
