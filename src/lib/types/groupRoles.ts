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

export const ROLE_ACCESS_OPTIONS = [
  { label: 'Dashboard', prefix: '/' },
  { label: 'Gestion groupe', prefix: '/group' },
  { label: 'Finance', prefix: '/finance' },
  { label: 'Dépenses', prefix: '/depenses' },
  { label: 'Items', prefix: '/items' },
  { label: 'Drogues', prefix: '/drogues' },
  { label: 'Tablette', prefix: '/tablette' },
  { label: 'Activités', prefix: '/activites' },
] as const

export const DEFAULT_CHEF_PREFIXES = ['/']
export const DEFAULT_MEMBER_PREFIXES = ['/tablette', '/finance/depense', '/depenses', '/activites']
