'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { listTenantGroups, type TenantGroup } from '@/lib/tenantAuthApi'
import { getTenantSession } from '@/lib/tenantSession'
import { PageHeader } from '@/components/PageHeader'

export default function AdminDashboardPage() {
  const [groups, setGroups] = useState<TenantGroup[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const session = getTenantSession()
    if (!(session?.isAdmin || session?.groupId === 'admin')) {
      window.location.href = '/'
      return
    }

    void listTenantGroups()
      .then((data) => {
        setGroups(data)
        setError(null)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Impossible de charger les statistiques admin.'
        setError(message)
      })
  }, [])

  const stats = useMemo(() => {
    const now = Date.now()
    const active = groups.filter((g) => g.active).length
    const expired = groups.filter((g) => g.paid_until && new Date(g.paid_until).getTime() < now).length
    const unlimited = groups.filter((g) => !g.paid_until).length
    return { active, expired, unlimited }
  }, [groups])

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <PageHeader title="Admin • Dashboard" subtitle="Vue rapide de la gestion globale." />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <p className="text-sm text-white/60">Groupes actifs</p>
            <p className="text-4xl font-semibold">{stats.active}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <p className="text-sm text-white/60">Groupes expirés</p>
            <p className="text-4xl font-semibold">{stats.expired}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <p className="text-sm text-white/60">Groupes illimités</p>
            <p className="text-4xl font-semibold">{stats.unlimited}</p>
          </article>
        </div>

        {error ? <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Link href="/admin/groupes" className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow transition hover:bg-white/[0.09]">
          <h2 className="text-lg font-semibold">Admin groups</h2>
          <p className="mt-2 text-sm text-white/70">Gérer les accès, identifiants et expirations.</p>
        </Link>
        <Link href="/admin/support" className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow transition hover:bg-white/[0.09]">
          <h2 className="text-lg font-semibold">Support</h2>
          <p className="mt-2 text-sm text-white/70">Traiter rapidement les messages et bugs.</p>
        </Link>
        <Link href="/admin/patch-notes" className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow transition hover:bg-white/[0.09]">
          <h2 className="text-lg font-semibold">Patch notes</h2>
          <p className="mt-2 text-sm text-white/70">Publier et mettre à jour les annonces produit.</p>
        </Link>
      </section>
    </div>
  )
}
