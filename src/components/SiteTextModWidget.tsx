'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, SlidersHorizontal } from 'lucide-react'
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
    <div
      className="fixed bottom-3 right-4 z-[130]"
      data-mod-widget="true"
    >
      <div className="flex items-center gap-1 rounded-xl border border-white/20 bg-slate-950/85 p-1.5 shadow-glow backdrop-blur">
        <button
          type="button"
          onClick={() => router.push('/admin/logs')}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[11px] font-medium text-white/90 hover:bg-white/10"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Logs
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/dashboard')}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[11px] font-medium text-white/90 hover:bg-white/10"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Mod
        </button>
      </div>
    </div>
  )
}
