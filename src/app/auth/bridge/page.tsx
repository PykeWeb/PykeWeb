'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getTenantSession, syncTenantSessionToServer } from '@/lib/tenantSession'

function normalizeNextPath(input: string | null) {
  if (!input || !input.startsWith('/')) return '/'
  return input.startsWith('/auth/bridge') ? '/' : input
}

export default function AuthBridgePage() {
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const nextPath = useMemo(() => normalizeNextPath(params.get('next')), [params])

  useEffect(() => {
    const session = getTenantSession()
    if (!session) {
      window.location.replace('/login')
      return
    }

    void syncTenantSessionToServer(session)
      .then(() => {
        window.location.replace(nextPath)
      })
      .catch(() => {
        setError('Impossible de finaliser la session. Réessayez.')
      })
  }, [nextPath])

  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-glow">
        <p className="text-sm text-white/80">Initialisation de la session…</p>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  )
}
