'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Package, Crosshair, Wrench, Leaf, Receipt } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { useUiSettings } from '@/lib/useUiSettings'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
import { getCurrentGroupAccessInfo } from '@/lib/communicationApi'
import clsx from 'clsx'

type AccessInfo = { paid_until: string | null; active: boolean } | null

const NavItem = ({ href, label, icon, active }: { href: string; label: string; icon: ReactNode; active: boolean }) => {
  return (
    <Link
      href={href}
      className={clsx(
        'flex items-center gap-3 rounded-2xl border px-5 py-4 text-base font-semibold shadow-glow transition',
        active ? 'border-white/25 bg-white/[0.11] text-white' : 'border-white/10 bg-white/5 text-white/90 hover:bg-white/10'
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white/90">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { labels } = useUiSettings()
  const [groupName, setGroupName] = useState('Groupe')
  const [groupBadge, setGroupBadge] = useState('GROUPE')
  const [isAdmin, setIsAdmin] = useState(false)
  const [accessInfo, setAccessInfo] = useState<AccessInfo>(null)

  useEffect(() => {
    const session = getTenantSession()
    setGroupName(session?.groupName || 'Groupe')
    setGroupBadge(session?.groupBadge || 'GROUPE')
    setIsAdmin(Boolean(session?.isAdmin))
  }, [])

  useEffect(() => {
    if (isAdmin) return
    getCurrentGroupAccessInfo().then((data) => setAccessInfo(data ? { paid_until: data.paid_until, active: data.active } : null)).catch(() => setAccessInfo(null))
  }, [isAdmin])

  const accessLabel = useMemo(() => {
    if (!accessInfo) return '—'
    if (!accessInfo.active) return 'Expiré'
    if (!accessInfo.paid_until) return 'Illimité'
    const ts = new Date(accessInfo.paid_until).getTime()
    if (ts < Date.now()) return 'Expiré'
    return `Valide jusqu’au ${new Date(accessInfo.paid_until).toLocaleDateString('fr-FR')}`
  }, [accessInfo])

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col gap-4 md:flex">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <Image src="/logo.png" alt="Logo" fill className="object-cover" />
          </div>
          <div>
            <p className="text-2xl font-semibold leading-tight">{labels.site_name || BRAND.name}</p>
            <p className="text-base text-white/70">{labels.site_tagline || BRAND.tagline}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm text-white/60">Groupe</p>
          <p className="mt-2 text-xl font-semibold tracking-tight">{groupName}</p>
          <div className="mt-3 inline-flex rounded-full border border-white/15 bg-white/15 px-3 py-1.5 text-sm font-semibold text-white/90 backdrop-blur-sm">{groupBadge}</div>
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-sm text-white/55">Accès</p>
            <p className="mt-1 text-sm font-semibold text-white/90">{accessLabel}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {isAdmin ? (
          <NavItem href="/admin/groupes" label="Admin groupes" icon={<LayoutGrid className="h-5 w-5" />} active={pathname.startsWith('/admin/groupes')} />
        ) : (
          <>
            <NavItem href="/" label={labels.nav_dashboard || 'Dashboard'} icon={<LayoutGrid className="h-5 w-5" />} active={pathname === '/'} />
            <NavItem href="/objets" label={labels.nav_objets || 'Objets'} icon={<Package className="h-5 w-5" />} active={pathname.startsWith('/objets')} />
            <NavItem href="/armes" label={labels.nav_armes || 'Armes'} icon={<Crosshair className="h-5 w-5" />} active={pathname.startsWith('/armes')} />
            <NavItem href="/equipement" label={labels.nav_equipement || 'Équipement'} icon={<Wrench className="h-5 w-5" />} active={pathname.startsWith('/equipement')} />
            <NavItem href="/drogues" label={labels.nav_drogues || 'Drogues'} icon={<Leaf className="h-5 w-5" />} active={pathname.startsWith('/drogues')} />
            <NavItem href="/depenses" label={labels.nav_depenses || 'Dépenses'} icon={<Receipt className="h-5 w-5" />} active={pathname.startsWith('/depenses')} />
          </>
        )}
      </div>
    </aside>
  )
}
