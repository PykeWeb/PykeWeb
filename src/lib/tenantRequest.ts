export function withTenantSessionHeader(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    credentials: init.credentials ?? 'include',
  }
}
