const DEPRECATED_ROUTE_MAP: Record<string, string> = {
  '/dashboard': '/',
  '/index.html': '/',
  '/home': '/',
  '/map': '/',
  '/mod': '/group',
  '/tablette/coffre': '/tablette',
  '/drogues/partenaires': '/drogues/sessions',
}

export function normalizeAppPath(input: string | null | undefined) {
  if (!input || !input.startsWith('/')) return '/'

  const [rawPath, rawQuery = ''] = input.split('?')
  const path = rawPath.replace(/\/+$/, '') || '/'
  const normalizedPath = DEPRECATED_ROUTE_MAP[path] || path

  if (normalizedPath.startsWith('/auth/bridge')) return '/'
  if (!rawQuery) return normalizedPath
  return `${normalizedPath}?${rawQuery}`
}
