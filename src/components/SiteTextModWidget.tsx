'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTenantSession, isAdminTenantSession } from '@/lib/tenantSession'

export function SiteTextModWidget() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const session = getTenantSession()
    setIsAdmin(isAdminTenantSession(session))
  }, [])

  if (!isAdmin) return null

  return (
    <div className="fixed bottom-4 right-4 z-[130] flex flex-col gap-2" data-mod-widget="true">
      <button
        type="button"
        onClick={() => router.push('/admin/dashboard')}
        className="h-10 rounded-xl border border-cyan-300/35 bg-cyan-500/20 px-3 text-xs font-semibold text-cyan-50 shadow-glow hover:bg-cyan-500/30"
      >
        Mod
      </button>
      <button
        type="button"
        onClick={() => router.push('/admin/logs')}
        className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white/90 shadow-glow hover:bg-white/20"
      >
        Logs
      </button>
    </div>
  )
}
