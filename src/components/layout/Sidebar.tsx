'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Boxes, LifeBuoy, ScrollText, Wallet, Smartphone } from 'lucide-react'
import { BRAND } from '@/lib/constants/brand'
import { useUiSettings } from '@/lib/useUiSettings'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearTenantSession, clearTenantSessionOnServer, getTenantSession, isAdminTenantSession } from '@/lib/tenantSession'
import { getCurrentGroupAccessInfo } from '@/lib/communicationApi'
import clsx from 'clsx'
import { LongPressReorderableRow } from '@/components/drag/LongPressReorderables'
import { getLayoutOrder, saveLayoutOrder } from '@/lib/uiLayoutsApi'

type AccessInfo = { paid_until: string | null; active: boolean } | null

type NavLink = { id: string; href: string; label: string; icon: ReactNode; active: boolean }

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
  const [navOrder, setNavOrder] = useState(['dashboard', 'finance', 'items', 'tablet'])

  useEffect(() => {
    const session = getTenantSession()
    setGroupName(session?.groupName || 'Groupe')
    setGroupBadge(session?.groupBadge || 'GROUPE')
    setIsAdmin(isAdminTenantSession(session))
  }, [])

  useEffect(() => {
    if (isAdmin) return
    getCurrentGroupAccessInfo().then((data) => setAccessInfo(data ? { paid_until: data.paid_until, active: data.active } : null)).catch(() => setAccessInfo(null))
    void (async () => {
      const saved = await getLayoutOrder('sidebar.nav')
      if (saved.length) setNavOrder(saved)
    })()
  }, [isAdmin])

  const accessStatus = useMemo(() => {
    if (!accessInfo) {
      return { label: '—', className: 'border-white/15 bg-white/5 text-white/75' }
    }

    if (!accessInfo.active) {
      return { label: 'Expiré', className: 'border-rose-300/35 bg-rose-500/20 text-rose-100' }
    }

    if (!accessInfo.paid_until) {
      return { label: 'Illimité', className: 'border-amber-300/35 bg-amber-500/20 text-amber-100' }
    }

    const ts = new Date(accessInfo.paid_until).getTime()
    const now = Date.now()
    if (!Number.isFinite(ts) || ts <= now) {
      return { label: 'Expiré', className: 'border-rose-300/35 bg-rose-500/20 text-rose-100' }
    }

    const daysLeft = (ts - now) / (1000 * 60 * 60 * 24)
    const dateLabel = new Date(accessInfo.paid_until).toLocaleDateString('fr-FR')

    if (daysLeft <= 10) {
      return { label: `Valide jusqu’au ${dateLabel}`, className: 'border-rose-300/35 bg-rose-500/20 text-rose-100' }
    }

    return { label: `Valide jusqu’au ${dateLabel}`, className: 'border-emerald-300/35 bg-emerald-500/20 text-emerald-100' }
  }, [accessInfo])

  const userNavLinks: NavLink[] = [
    { id: 'dashboard', href: '/', label: labels.nav_dashboard || 'Dashboard', icon: <LayoutGrid className="h-5 w-5" />, active: pathname === '/' },
    { id: 'finance', href: '/finance', label: labels.nav_finance || 'Finance', icon: <Wallet className="h-5 w-5" />, active: pathname.startsWith('/finance') },
    { id: 'items', href: '/items', label: 'Items', icon: <Boxes className="h-5 w-5" />, active: pathname.startsWith('/items') },
    { id: 'tablet', href: '/tablette/paiement', label: 'Tablette', icon: <Smartphone className="h-5 w-5" />, active: pathname.startsWith('/tablette/paiement') },
  ]

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col gap-4 md:flex md:max-h-[calc(100vh-3rem)] md:overflow-y-auto md:pr-1">
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/60">Groupe</p>
            <button
              type="button"
              onClick={() => {
                clearTenantSession()
                void clearTenantSessionOnServer().finally(() => {
                  window.location.href = '/login'
                })
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/90 transition hover:bg-white/10"
            >
              Déconnexion
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-xl font-semibold tracking-tight">{groupName}</p>
            <div className="inline-flex shrink-0 rounded-full border border-white/15 bg-white/15 px-3 py-1.5 text-sm font-semibold text-white/90 backdrop-blur-sm">{groupBadge}</div>
          </div>
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-sm text-white/55">Accès</p>
            <p className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-sm font-semibold ${accessStatus.className}`}>{accessStatus.label}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {isAdmin ? (
          <>
            <NavItem href="/admin/dashboard" label="Dashboard" icon={<LayoutGrid className="h-5 w-5" />} active={pathname.startsWith('/admin/dashboard')} />
            <NavItem href="/admin/groupes" label="Admin groupes" icon={<LayoutGrid className="h-5 w-5" />} active={pathname.startsWith('/admin/groupes')} />
            <NavItem href="/admin/catalogue-global" label="Objets" icon={<Boxes className="h-5 w-5" />} active={pathname.startsWith('/admin/catalogue-global')} />
            <NavItem href="/admin/support" label="Support" icon={<LifeBuoy className="h-5 w-5" />} active={pathname.startsWith('/admin/support')} />
            <NavItem href="/admin/tablette" label="Tablette" icon={<Smartphone className="h-5 w-5" />} active={pathname.startsWith('/admin/tablette')} />
            <NavItem href="/admin/patch-notes" label="Patch notes" icon={<ScrollText className="h-5 w-5" />} active={pathname.startsWith('/admin/patch-notes')} />
          </>
        ) : (
          <LongPressReorderableRow
            className="flex flex-col gap-3"
            order={navOrder}
            onOrderChange={async (next) => {
              setNavOrder(next)
              await saveLayoutOrder('sidebar.nav', next, 'group')
            }}
            items={userNavLinks.map((link) => ({
              id: link.id,
              element: <NavItem href={link.href} label={link.label} icon={link.icon} active={link.active} />,
            }))}
          />
        )}
      </div>
    </aside>
  )
}
