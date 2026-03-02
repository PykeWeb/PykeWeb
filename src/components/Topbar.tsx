'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clearTenantSession, getTenantSession } from '@/lib/tenantSession'

export function Topbar() {
  const [groupName, setGroupName] = useState('Groupe')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const session = getTenantSession()
    setGroupName(session?.groupName || 'Groupe')
    setIsAdmin(Boolean(session?.isAdmin))
  }, [])

  return (
    <div className="flex items-center justify-end">
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 shadow-glow md:flex">
          <span className="text-white/60">Groupe :</span>
          <span className="font-semibold text-white">{groupName}</span>
        </div>

        {isAdmin ? (
          <Link
            href="/admin/groupes"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10"
          >
            Admin groupes
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => {
            clearTenantSession()
            window.location.href = '/login'
          }}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10"
        >
          Déconnexion
        </button>
      </div>
    </div>
  )
}
