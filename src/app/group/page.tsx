'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTenantSession, isAdminTenantSession } from '@/lib/tenantSession'
import { getCurrentGroupAccessInfo } from '@/lib/communicationApi'
import { PageHeader } from '@/components/PageHeader'
import { GroupMembersGradesSection } from '@/app/admin/groupes/[id]/ui/GroupMembersGradesSection'

type AccessInfo = { paid_until: string | null; active: boolean } | null

export default function GroupSettingsPage() {
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('Groupe')
  const [groupBadge, setGroupBadge] = useState<string | null>(null)
  const [roleLabel, setRoleLabel] = useState('')
  const [accessInfo, setAccessInfo] = useState<AccessInfo>(null)

  useEffect(() => {
    const session = getTenantSession()
    if (!session) {
      window.location.href = '/login'
      return
    }

    if (isAdminTenantSession(session)) {
      window.location.href = '/admin/groupes'
      return
    }

    setGroupId(session.groupId)
    setGroupName(session.groupName || 'Groupe')
    setGroupBadge(session.groupBadge || null)
    setRoleLabel(session.roleLabel || (session.role === 'chef' ? 'Boss' : session.role === 'member' ? 'Membre' : ''))

    getCurrentGroupAccessInfo()
      .then((data) => setAccessInfo(data ? { paid_until: data.paid_until, active: data.active } : null))
      .catch(() => setAccessInfo(null))
  }, [])

  if (!groupId) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">Chargement du groupe…</div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <PageHeader
          title="Gestion du groupe"
          subtitle="Général, membres, rôles et permissions pour votre groupe connecté."
          size="compact"
        />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
            <p className="text-white/60">Groupe</p>
            <p className="mt-1 font-semibold">{groupName}{groupBadge ? ` (${groupBadge})` : ''}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
            <p className="text-white/60">Rôle courant</p>
            <p className="mt-1 font-semibold">{roleLabel || '—'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
            <p className="text-white/60">Licence</p>
            <p className="mt-1 font-semibold">
              {accessInfo ? (accessInfo.active ? (accessInfo.paid_until ? new Date(accessInfo.paid_until).toLocaleDateString('fr-FR') : 'Illimitée') : 'Inactive') : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm">
            <p className="text-emerald-100/80">Gestion de paye</p>
            <Link href="/cash/paye" className="mt-1 inline-flex text-sm font-semibold text-emerald-100 underline-offset-4 hover:underline">
              Ouvrir la paye
            </Link>
          </div>
        </div>
      </div>

      <div id="section-members-roles">
        <GroupMembersGradesSection groupId={groupId} />
      </div>

    </div>
  )
}
