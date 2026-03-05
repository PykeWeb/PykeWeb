'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clearTenantSession, getTenantSession, isAdminTenantSession } from '@/lib/tenantSession'
import { SecondaryButton } from '@/components/ui/design-system'

export function Topbar() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const session = getTenantSession()
    setIsAdmin(isAdminTenantSession(session))
  }, [])

  return (
    <div className="flex items-center justify-end">
      <div className="flex items-center gap-3">
        {isAdmin ? (
          <Link href="/admin/dashboard">
            <SecondaryButton>Admin groupes</SecondaryButton>
          </Link>
        ) : null}

        <SecondaryButton
          type="button"
          onClick={() => {
            clearTenantSession()
            window.location.href = '/login'
          }}
        >
          Déconnexion
        </SecondaryButton>
      </div>
    </div>
  )
}
