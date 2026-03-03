'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { getTenantSession } from '@/lib/tenantSession'

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'
  const [authChecked, setAuthChecked] = useState(isLogin)

  useEffect(() => {
    if (isLogin) {
      setAuthChecked(true)
      return
    }

    const session = getTenantSession()
    if (!session?.groupId || !session.groupName?.trim()) {
      window.location.href = '/login'
      return
    }

    if (pathname === '/' && session.isAdmin) {
      window.location.href = '/admin/dashboard'
      return
    }

    setAuthChecked(true)
  }, [isLogin, pathname])

  if (!authChecked) {
    return <main className="mx-auto min-h-screen w-full max-w-[1480px] px-4 py-6" />
  }

  if (isLogin) {
    return <main className="mx-auto min-h-screen w-full max-w-[1480px] px-4 py-6">{children}</main>
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1480px] gap-6 px-4 py-6">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col gap-6">
        <Topbar />
        {children}
      </main>
    </div>
  )
}
