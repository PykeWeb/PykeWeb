'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Package, Crosshair, Wrench, Leaf, Receipt, Boxes, LifeBuoy, ScrollText, Wallet } from 'lucide-react'
import { BRAND } from '@/lib/constants/brand'
import { useUiSettings } from '@/lib/useUiSettings'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
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
  const [navOrder, setNavOrder] = useState(['dashboard', 'objects', 'weapons', 'equipment', 'drugs', 'expenses', 'finance', 'items'])
  const [hiddenCategoryNav, setHiddenCategoryNav] = useState<string[]>([])

  useEffect(() => {
    const session = getTenantSession()
    setGroupName(session?.groupName || 'Groupe')
    setGroupBadge(session?.groupBadge || 'GROUPE')
    setIsAdmin(Boolean(session?.isAdmin))
  }, [])

  useEffect(() => {
    if (isAdmin) return
    getCurrentGroupAccessInfo().then((data) => setAccessInfo(data ? { paid_until: data.paid_until, active: data.active } : null)).catch(() => setAccessInfo(null))
    void (async () => {
      const saved = await getLayoutOrder('sidebar.nav')
      if (saved.length) setNavOrder(saved)
    })()
  }, [isAdmin])

  useEffect(() => {
    if (typeof window === 'undefined' || isAdmin) return
    const raw = window.localStorage.getItem('pyke.hiddenCategoryNav')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed)) setHiddenCategoryNav(parsed)
    } catch {
      // ignore
    }
  }, [isAdmin])

  const accessLabel = useMemo(() => {
    if (!accessInfo) return '—'
    if (!accessInfo.active) return 'Expiré'
    if (!accessInfo.paid_until) return 'Illimité'
    const ts = new Date(accessInfo.paid_until).getTime()
    if (ts < Date.now()) return 'Expiré'
    return `Valide jusqu’au ${new Date(accessInfo.paid_until).toLocaleDateString('fr-FR')}`
  }, [accessInfo])

  const userNavLinks: NavLink[] = [
    { id: 'dashboard', href: '/', label: labels.nav_dashboard || 'Dashboard', icon: <LayoutGrid className="h-5 w-5" />, active: pathname === '/' },
    { id: 'objects', href: '/objets', label: labels.nav_objets || 'Objets', icon: <Package className="h-5 w-5" />, active: pathname.startsWith('/objets') },
    { id: 'weapons', href: '/armes', label: labels.nav_armes || 'Armes', icon: <Crosshair className="h-5 w-5" />, active: pathname.startsWith('/armes') },
    { id: 'equipment', href: '/equipement', label: labels.nav_equipement || 'Équipement', icon: <Wrench className="h-5 w-5" />, active: pathname.startsWith('/equipement') },
    { id: 'drugs', href: '/drogues', label: labels.nav_drogues || 'Drogues', icon: <Leaf className="h-5 w-5" />, active: pathname.startsWith('/drogues') },
    { id: 'expenses', href: '/depenses', label: labels.nav_depenses || 'Dépenses', icon: <Receipt className="h-5 w-5" />, active: pathname.startsWith('/depenses') },
    { id: 'finance', href: '/finance', label: labels.nav_finance || 'Finance', icon: <Wallet className="h-5 w-5" />, active: pathname.startsWith('/finance') },
    { id: 'items', href: '/items', label: 'Items', icon: <Boxes className="h-5 w-5" />, active: pathname.startsWith('/items') },
  ]

  const visibleUserNavLinks = userNavLinks.filter((link) => {
    const isCategory = link.id === 'objects' || link.id === 'weapons' || link.id === 'equipment' || link.id === 'drugs'
    if (!isCategory) return true
    if (link.active) return true
    return !hiddenCategoryNav.includes(link.id)
  })

  const categoryToggles = [
    { id: 'objects', label: labels.nav_objets || 'Objets' },
    { id: 'weapons', label: labels.nav_armes || 'Armes' },
    { id: 'equipment', label: labels.nav_equipement || 'Équipement' },
    { id: 'drugs', label: labels.nav_drogues || 'Drogues' },
  ]

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
          <>
            <NavItem href="/admin/dashboard" label="Dashboard" icon={<LayoutGrid className="h-5 w-5" />} active={pathname.startsWith('/admin/dashboard')} />
            <NavItem href="/admin/groupes" label="Admin groupes" icon={<LayoutGrid className="h-5 w-5" />} active={pathname.startsWith('/admin/groupes')} />
            <NavItem href="/admin/catalogue-global" label="Objets" icon={<Boxes className="h-5 w-5" />} active={pathname.startsWith('/admin/catalogue-global')} />
            <NavItem href="/admin/support" label="Support" icon={<LifeBuoy className="h-5 w-5" />} active={pathname.startsWith('/admin/support')} />
            <NavItem href="/admin/patch-notes" label="Patch notes" icon={<ScrollText className="h-5 w-5" />} active={pathname.startsWith('/admin/patch-notes')} />
          </>
        ) : (
          <>
            <LongPressReorderableRow
              className="flex flex-col gap-3"
              order={navOrder}
              onOrderChange={async (next) => {
                setNavOrder(next)
                await saveLayoutOrder('sidebar.nav', next, 'group')
              }}
              items={visibleUserNavLinks.map((link) => ({
                id: link.id,
                element: <NavItem href={link.href} label={link.label} icon={link.icon} active={link.active} />,
              }))}
            />

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/70">
              <p className="mb-2 font-semibold text-white/85">Afficher les catégories</p>
              <div className="grid grid-cols-2 gap-2">
                {categoryToggles.map((row) => {
                  const checked = !hiddenCategoryNav.includes(row.id)
                  return (
                    <label key={row.id} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? hiddenCategoryNav.filter((id) => id !== row.id)
                            : [...hiddenCategoryNav, row.id]
                          setHiddenCategoryNav(next)
                          if (typeof window !== 'undefined') window.localStorage.setItem('pyke.hiddenCategoryNav', JSON.stringify(next))
                        }}
                        className="h-4 w-4 rounded border-white/20 bg-white/5"
                      />
                      {row.label}
                    </label>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
