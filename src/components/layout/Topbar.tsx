'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getTenantSession, isAdminTenantSession } from '@/lib/tenantSession'
import { SecondaryButton } from '@/components/ui/design-system'

export function Topbar() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const session = getTenantSession()
    setIsAdmin(isAdminTenantSession(session))
  }, [])

  if (!isAdmin) return null

  return (
    <div className="flex items-center justify-end">
      <Link href="/admin/dashboard">
        <SecondaryButton>Admin groupes</SecondaryButton>
      </Link>
    </div>
  )
}
