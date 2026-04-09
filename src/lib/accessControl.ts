import type { TenantSession } from '@/lib/tenantSession'
import { isAdminTenantSession, isMemberTenantSession } from '@/lib/tenantSession'
import { DEFAULT_MEMBER_PREFIXES, expandAccessPrefixes } from '@/lib/types/groupRoles'

const PUBLIC_PATHS = ['/', '/login', '/auth/bridge']

function cleanPath(pathname: string) {
  const trimmed = String(pathname || '/').trim() || '/'
  const noQuery = trimmed.split('?')[0] || '/'
  return noQuery.split('#')[0] || '/'
}

function resolveRequiredPrefix(pathname: string) {
  const path = cleanPath(pathname)
  if (path === '/') return '/dashboard'
  if (path === '/activites/gestion-chef' || path.startsWith('/activites/gestion-chef/')) return '/activites/gestion-chef'
  if (path === '/finance/achat-vente' || path.startsWith('/finance/achat-vente/')) return '/finance/achat-vente'
  if (path === '/finance/entree-sortie' || path.startsWith('/finance/entree-sortie/')) return '/finance/entree-sortie'
  if (path === '/finance/depense' || path.startsWith('/finance/depense/')) return '/finance/depense'
  if (path === '/drogues') return '/drogues'
  if (path === '/drogues/benefice' || path.startsWith('/drogues/benefice/')) return '/drogues/benefice'
  if (path === '/drogues/vente' || path.startsWith('/drogues/vente/')) return '/drogues/vente'
  if (path === '/drogues/sessions' || path.startsWith('/drogues/sessions/') || path === '/drogues/partenaires' || path.startsWith('/drogues/partenaires/')) return '/drogues/partenaires'
  if (path === '/drogues/suivi-production' || path.startsWith('/drogues/suivi-production/') || path === '/drogues/demandes' || path.startsWith('/drogues/demandes/')) return '/drogues/suivi-production'
  if (path === '/tablette/paiement' || path.startsWith('/tablette/paiement/')) return '/tablette/paiement'
  if (path === '/cash/paye' || path.startsWith('/cash/paye/')) return '/cash/paye'
  if (path === '/tablette' || path.startsWith('/tablette/')) return '/operations'
  if (path === '/activites' || path.startsWith('/activites/')) return '/operations'
  if (path === '/finance' || path.startsWith('/finance/')) return '/finance'
  if (path === '/group' || path.startsWith('/group/')) return '/group'
  if (path === '/cash' || path.startsWith('/cash/')) return '/cash'
  if (path === '/annuaire' || path.startsWith('/annuaire/')) return '/annuaire'
  if (path === '/items' || path.startsWith('/items/')) return '/items'
  return path
}

export function hasRequiredPrefixAccess(allowedPrefixes: string[], requiredPrefix: string) {
  const prefixes = expandAccessPrefixes(allowedPrefixes.length > 0 ? allowedPrefixes : DEFAULT_MEMBER_PREFIXES)
  if (prefixes.includes('/')) return true
  if (requiredPrefix === '/dashboard') return prefixes.includes('/dashboard')
  if (requiredPrefix === '/operations') return prefixes.includes('/operations') || prefixes.includes('/activites') || prefixes.includes('/tablette')
  if (requiredPrefix.startsWith('/finance/')) return prefixes.includes('/finance') || prefixes.includes(requiredPrefix)
  if (requiredPrefix.startsWith('/cash/')) return prefixes.includes('/cash') || prefixes.includes(requiredPrefix)
  return prefixes.includes(requiredPrefix)
}

export function isMemberRouteAllowed(pathname: string, allowedPrefixes: string[] = DEFAULT_MEMBER_PREFIXES) {
  const required = resolveRequiredPrefix(pathname)
  return hasRequiredPrefixAccess(allowedPrefixes, required)
}

export function getDefaultRouteForSession(session: TenantSession) {
  if (isAdminTenantSession(session)) return '/admin/dashboard'

  const allowedPrefixes = expandAccessPrefixes(session.allowedPrefixes ?? [])
  if (allowedPrefixes.includes('/')) return '/'
  if (allowedPrefixes.includes('/dashboard')) return '/'
  if (allowedPrefixes.length > 0) {
    const first = allowedPrefixes[0]
    if (first === '/operations') return '/activites'
    if (first === '/tablette/coffre') return '/tablette'
    if (first === '/tablette/paiement') return '/tablette'
    if (first === '/drogues/suivi-production') return '/drogues/suivi-production'
    if (first === '/drogues/partenaires') return '/drogues/suivi-production'
    if (first === '/finance/achat-vente' || first === '/finance/entree-sortie' || first === '/finance/depense') return '/finance'
    if (first === '/cash/paye') return '/cash'
    return first.startsWith('/admin') ? '/admin/dashboard' : first
  }

  if (isMemberTenantSession(session)) return '/tablette'
  return '/'
}

export function canAccessPath(session: TenantSession, pathname: string) {
  if (isAdminTenantSession(session)) return true
  const safePath = cleanPath(pathname)
  if (PUBLIC_PATHS.includes(safePath)) return true

  const allowedPrefixes = expandAccessPrefixes(session.allowedPrefixes ?? [])
  if (safePath === '/activites/gestion-chef' || safePath.startsWith('/activites/gestion-chef/')) {
    return allowedPrefixes.includes('/') || allowedPrefixes.includes('/activites/gestion-chef')
  }
  if (allowedPrefixes.length > 0) return isMemberRouteAllowed(safePath, allowedPrefixes)

  if (!isMemberTenantSession(session)) return true
  return isMemberRouteAllowed(safePath)
}
