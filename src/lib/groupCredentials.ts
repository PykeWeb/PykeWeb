export type GroupCredentials = {
  chefPassword: string
  memberPassword: string | null
}

const CREDENTIALS_PREFIX = '__roles__:'

type EncodedCredentials = {
  chef: string
  member?: string | null
}

export function parseGroupCredentials(rawPassword: string | null | undefined): GroupCredentials {
  const source = typeof rawPassword === 'string' ? rawPassword.trim() : ''
  if (!source) {
    return { chefPassword: '', memberPassword: null }
  }

  if (!source.startsWith(CREDENTIALS_PREFIX)) {
    return { chefPassword: source, memberPassword: null }
  }

  const payload = source.slice(CREDENTIALS_PREFIX.length)
  try {
    const parsed = JSON.parse(payload) as EncodedCredentials
    const chefPassword = typeof parsed.chef === 'string' ? parsed.chef.trim() : ''
    const memberPassword = typeof parsed.member === 'string' ? parsed.member.trim() : ''
    return {
      chefPassword,
      memberPassword: memberPassword.length > 0 ? memberPassword : null,
    }
  } catch {
    return { chefPassword: source, memberPassword: null }
  }
}

export function encodeGroupCredentials(input: { chefPassword: string; memberPassword?: string | null }) {
  const chefPassword = input.chefPassword.trim()
  const memberPassword = (input.memberPassword ?? '').trim()

  if (!chefPassword) return ''
  if (!memberPassword || memberPassword === chefPassword) return chefPassword

  const payload: EncodedCredentials = { chef: chefPassword, member: memberPassword }
  return `${CREDENTIALS_PREFIX}${JSON.stringify(payload)}`
}

export function resolveGroupLoginRole(rawPassword: string | null | undefined, candidate: string) {
  const password = candidate.trim()
  if (!password) return null

  const credentials = parseGroupCredentials(rawPassword)
  if (credentials.chefPassword && password === credentials.chefPassword) return 'chef' as const
  if (credentials.memberPassword && password === credentials.memberPassword) return 'member' as const
  return null
}
