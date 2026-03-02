'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

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
