import {
  DEFAULT_CHEF_PREFIXES,
  DEFAULT_MEMBER_PREFIXES,
  type GroupRoleDefinition,
  type GroupRolesConfig,
} from '@/lib/types/groupRoles'

export type GroupCredentials = {
  chefPassword: string
  memberPassword: string | null
  roles: GroupRoleDefinition[]
}

const CREDENTIALS_PREFIX = '__roles__:'

type EncodedCredentials = {
  chef?: string
  member?: string | null
  roles?: Array<Partial<GroupRoleDefinition>>
}

function normalizeAllowedPrefixes(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return [...fallback]
  const unique = Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)))
  return unique.length > 0 ? unique : [...fallback]
}

function normalizeRoleDefinition(input: Partial<GroupRoleDefinition>, fallbackKey: string, fallbackName: string, fallbackPrefixes: string[]) {
  const key = typeof input.key === 'string' && input.key.trim() ? input.key.trim() : fallbackKey
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : fallbackName
  const password = typeof input.password === 'string' ? input.password.trim() : ''

  return {
    key,
    name,
    password,
    allowedPrefixes: normalizeAllowedPrefixes(input.allowedPrefixes, fallbackPrefixes),
  }
}

function dedupeRoleKeys(roles: GroupRoleDefinition[]) {
  const seen = new Set<string>()
  return roles.map((role, index) => {
    if (!seen.has(role.key)) {
      seen.add(role.key)
      return role
    }
    let next = `${role.key}_${index + 1}`
    while (seen.has(next)) next = `${next}_x`
    seen.add(next)
    return { ...role, key: next }
  })
}

function normalizeRoles(roles: Array<Partial<GroupRoleDefinition>> | undefined, chefPassword: string, memberPassword: string | null) {
  const normalized = (roles ?? [])
    .map((role, index) => normalizeRoleDefinition(role, role.key?.trim() || `role_${index + 1}`, role.name?.trim() || `Rôle ${index + 1}`, ['/']))
    .filter((role) => role.password.length > 0)

  const hasChef = normalized.some((role) => role.key === 'chef')
  const hasMember = normalized.some((role) => role.key === 'member')

  const baseRoles: GroupRoleDefinition[] = [
    ...(hasChef ? [] : [{ key: 'chef', name: 'Admin', password: chefPassword, allowedPrefixes: [...DEFAULT_CHEF_PREFIXES] }]),
    ...(memberPassword && !hasMember ? [{ key: 'member', name: 'Membre', password: memberPassword, allowedPrefixes: [...DEFAULT_MEMBER_PREFIXES] }] : []),
    ...normalized,
  ].filter((role) => role.password.length > 0)

  return dedupeRoleKeys(baseRoles)
}

export function parseGroupCredentials(rawPassword: string | null | undefined): GroupCredentials {
  const source = typeof rawPassword === 'string' ? rawPassword.trim() : ''
  if (!source) {
    return {
      chefPassword: '',
      memberPassword: null,
      roles: [],
    }
  }

  if (!source.startsWith(CREDENTIALS_PREFIX)) {
    return {
      chefPassword: source,
      memberPassword: null,
      roles: [{ key: 'chef', name: 'Admin', password: source, allowedPrefixes: [...DEFAULT_CHEF_PREFIXES] }],
    }
  }

  const payload = source.slice(CREDENTIALS_PREFIX.length)
  try {
    const parsed = JSON.parse(payload) as EncodedCredentials
    const chefPassword = typeof parsed.chef === 'string' ? parsed.chef.trim() : ''
    const memberPassword = typeof parsed.member === 'string' ? parsed.member.trim() : ''
    const normalizedRoles = normalizeRoles(parsed.roles, chefPassword, memberPassword || null)

    const chefRole = normalizedRoles.find((role) => role.key === 'chef')
    const memberRole = normalizedRoles.find((role) => role.key === 'member')

    return {
      chefPassword: chefRole?.password || chefPassword,
      memberPassword: memberRole?.password || (memberPassword ? memberPassword : null),
      roles: normalizedRoles,
    }
  } catch {
    return {
      chefPassword: source,
      memberPassword: null,
      roles: [{ key: 'chef', name: 'Admin', password: source, allowedPrefixes: [...DEFAULT_CHEF_PREFIXES] }],
    }
  }
}

export function encodeGroupCredentials(input: {
  chefPassword: string
  memberPassword?: string | null
  roles?: GroupRoleDefinition[]
}) {
  const chefPassword = input.chefPassword.trim()
  const memberPassword = (input.memberPassword ?? '').trim()

  const normalizedRoles = dedupeRoleKeys(
    (input.roles ?? [])
      .map((role, index) => normalizeRoleDefinition(role, role.key || `role_${index + 1}`, role.name || `Rôle ${index + 1}`, role.key === 'member' ? DEFAULT_MEMBER_PREFIXES : ['/']))
      .filter((role) => role.password.length > 0),
  )

  const finalRoles = normalizeRoles(normalizedRoles, chefPassword, memberPassword || null)

  if (finalRoles.length === 1 && finalRoles[0]?.key === 'chef' && (!memberPassword || memberPassword === chefPassword)) {
    return chefPassword
  }

  if (!chefPassword && finalRoles.length === 0) return ''

  const payload: EncodedCredentials = {
    chef: finalRoles.find((role) => role.key === 'chef')?.password || chefPassword,
    member: finalRoles.find((role) => role.key === 'member')?.password || null,
    roles: finalRoles,
  }
  return `${CREDENTIALS_PREFIX}${JSON.stringify(payload)}`
}

export function resolveGroupLoginRole(rawPassword: string | null | undefined, candidate: string) {
  const password = candidate.trim()
  if (!password) return null

  const credentials = parseGroupCredentials(rawPassword)
  const matchingRole = credentials.roles.find((role) => role.password === password)
  if (!matchingRole) return null

  return {
    key: matchingRole.key,
    name: matchingRole.name,
    allowedPrefixes: matchingRole.allowedPrefixes,
  }
}

export function parseGroupRolesConfig(rawPassword: string | null | undefined): GroupRolesConfig {
  return { roles: parseGroupCredentials(rawPassword).roles }
}
