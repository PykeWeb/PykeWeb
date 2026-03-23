export type GroupRoleKey = string

export type GroupRoleDefinition = {
  key: GroupRoleKey
  name: string
  password: string
  allowedPrefixes: string[]
}

export type GroupRolesConfig = {
  roles: GroupRoleDefinition[]
}

export const GROUP_OPERATIONS_PREFIX = '/operations'
const LEGACY_OPERATIONS_PREFIXES = ['/tablette', '/activites'] as const
const LEGACY_DEPENSES_PREFIXES = ['/depenses', '/finance/depense'] as const

export const ROLE_ACCESS_OPTIONS = [
  { label: 'Dashboard', prefix: '/' },
  { label: 'Gestion groupe', prefix: '/group' },
  { label: 'Finance', prefix: '/finance' },
  { label: 'Items', prefix: '/items' },
  { label: 'Drogues', prefix: '/drogues' },
  { label: 'Activités', prefix: GROUP_OPERATIONS_PREFIX },
  { label: 'Gestion chef', prefix: '/activites/gestion-chef' },
] as const

export function normalizeRolePrefixes(prefixes: string[]) {
  const unique = Array.from(new Set(prefixes.map((entry) => entry.trim()).filter(Boolean)))
  if (unique.includes('/')) return ['/']

  const hasOperations = unique.includes(GROUP_OPERATIONS_PREFIX) || LEGACY_OPERATIONS_PREFIXES.some((prefix) => unique.includes(prefix))
  const hasDepenses = LEGACY_DEPENSES_PREFIXES.some((prefix) => unique.includes(prefix))
  const next = unique
    .filter((prefix) => !LEGACY_OPERATIONS_PREFIXES.includes(prefix as typeof LEGACY_OPERATIONS_PREFIXES[number]))
    .filter((prefix) => !LEGACY_DEPENSES_PREFIXES.includes(prefix as typeof LEGACY_DEPENSES_PREFIXES[number]))
  if (hasOperations) next.push(GROUP_OPERATIONS_PREFIX)
  if (hasDepenses) next.push(GROUP_OPERATIONS_PREFIX)

  return Array.from(new Set(next))
}

export function expandAccessPrefixes(prefixes: string[]) {
  const normalized = normalizeRolePrefixes(prefixes)
  if (normalized.includes('/')) return ['/']

  const expanded = [...normalized]
  if (normalized.includes(GROUP_OPERATIONS_PREFIX)) {
    expanded.push('/tablette', '/activites', '/activites/depense', '/depenses', '/finance/depense')
  }

  return Array.from(new Set(expanded))
}

export const DEFAULT_CHEF_PREFIXES = ['/']
export const DEFAULT_MEMBER_PREFIXES = [GROUP_OPERATIONS_PREFIX]
