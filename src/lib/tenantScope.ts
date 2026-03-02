import { requireTenantGroupId } from '@/lib/tenantSession'

export function currentGroupId() {
  return requireTenantGroupId()
}
