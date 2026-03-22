'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutGrid, Boxes, LifeBuoy, ScrollText, Wallet, Smartphone, ClipboardList, Truck, Pill, LogOut, Shield, KeyRound, PanelsTopLeft, Users, BadgeCheck, Sparkles } from 'lucide-react'
import { BRAND } from '@/lib/constants/brand'
import { useUiSettings } from '@/lib/useUiSettings'
import { resolvePageContext } from '@/lib/copy'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearTenantSession, clearTenantSessionOnServer, getTenantSession, isAdminTenantSession, isMemberTenantSession } from '@/lib/tenantSession'
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
  const searchParams = useSearchParams()
  const { labels } = useUiSettings()
  const [groupName, setGroupName] = useState('Groupe')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [isChef, setIsChef] = useState(false)
  const [accessInfo, setAccessInfo] = useState<AccessInfo>(null)
  const [navOrder, setNavOrder] = useState(['dashboard', 'finance', 'items', 'drogues', 'tablette'])
  const [isPwrGroup, setIsPwrGroup] = useState(false)
  const [roleLabel, setRoleLabel] = useState('')
  const [allowedPrefixes, setAllowedPrefixes] = useState<string[]>([])
  const pageContext = useMemo(() => resolvePageContext(pathname, searchParams.get('mode')), [pathname, searchParams])

  useEffect(() => {
    const session = getTenantSession()
    const nextGroupName = session?.groupName || 'Groupe'
    const nextGroupBadge = session?.groupBadge || 'GROUPE'
    setGroupName(nextGroupName)
    setIsAdmin(isAdminTenantSession(session))
    setIsMember(isMemberTenantSession(session))
    setIsChef(session?.role === 'chef')
    setRoleLabel(session?.roleLabel || (session?.role === 'member' ? 'Membre' : session?.role === 'chef' ? 'Admin' : ''))
    setAllowedPrefixes(Array.isArray(session?.allowedPrefixes) ? session.allowedPrefixes : [])
    const scope = `${nextGroupName} ${nextGroupBadge}`.toLowerCase()
    setIsPwrGroup(scope.includes('pwr'))
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
      return { label: dateLabel, className: 'border-amber-300/35 bg-amber-500/22 text-amber-100' }
    }

    return { label: dateLabel, className: 'border-amber-300/35 bg-amber-500/22 text-amber-100' }
  }, [accessInfo])

  const defaultUserLinks: NavLink[] = [
    { id: 'dashboard', href: '/', label: labels.nav_dashboard || 'Dashboard', icon: <LayoutGrid className="h-5 w-5" />, active: pathname === '/' },
    { id: 'group', href: '/group', label: 'Gestion du groupe', icon: <Users className="h-5 w-5" />, active: pathname.startsWith('/group') },
    { id: 'finance', href: '/finance', label: labels.nav_finance || 'Finance', icon: <Wallet className="h-5 w-5" />, active: pathname.startsWith('/finance') },
    ...(!isChef ? [{ id: 'depense', href: '/finance/depense/nouveau', label: 'Dépense', icon: <ClipboardList className="h-5 w-5" />, active: pathname.startsWith('/finance/depense') || pathname.startsWith('/depenses') } as NavLink] : []),
    { id: 'items', href: '/items', label: 'Items', icon: <Boxes className="h-5 w-5" />, active: pathname.startsWith('/items') },
    { id: 'activites', href: '/activites', label: 'Activités', icon: <ClipboardList className="h-5 w-5" />, active: pathname.startsWith('/activites') },
    { id: 'drogues', href: '/drogues', label: labels.nav_drogues || 'Drogues', icon: <Pill className="h-5 w-5" />, active: pathname.startsWith('/drogues') },
    { id: 'tablette', href: '/tablette', label: labels.nav_tablette || 'Tablette', icon: <Smartphone className="h-5 w-5" />, active: pathname.startsWith('/tablette') },
  ]

  const hasFullAccess = allowedPrefixes.includes('/')
  const filteredUserLinks = hasFullAccess
    ? defaultUserLinks
    : defaultUserLinks.filter((link) =>
      allowedPrefixes.some((prefix) => {
        if (link.href === '/') return prefix === '/'
        return link.href === prefix || link.href.startsWith(`${prefix}/`)
      })
    )

  const hasExplicitRoleRestrictions = allowedPrefixes.length > 0

  const userNavLinks: NavLink[] = isPwrGroup
    ? [{ id: 'pwr-commandes', href: '/pwr/commandes', label: 'Commande', icon: <Truck className="h-5 w-5" />, active: pathname.startsWith('/pwr/commandes') }]
    : filteredUserLinks.length > 0
      ? filteredUserLinks
      : hasExplicitRoleRestrictions
        ? []
        : isMember
          ? [
            { id: 'depense', href: '/finance/depense/nouveau', label: 'Dépense', icon: <ClipboardList className="h-5 w-5" />, active: pathname.startsWith('/finance/depense') || pathname.startsWith('/depenses') },
            { id: 'activites', href: '/activites', label: 'Activités', icon: <ClipboardList className="h-5 w-5" />, active: pathname.startsWith('/activites') },
            { id: 'tablette', href: '/tablette', label: labels.nav_tablette || 'Tablette', icon: <Smartphone className="h-5 w-5" />, active: pathname.startsWith('/tablette') },
          ]
          : defaultUserLinks

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col gap-4 md:flex md:max-h-[calc(100vh-3rem)] md:overflow-y-auto md:pr-1">
      <div className="rounded-[2rem] border border-[#5b6fc7]/28 bg-gradient-to-br from-[#11173a]/95 via-[#101633]/95 to-[#0b1027]/96 p-5 shadow-[0_16px_42px_rgba(4,8,28,0.58)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-white/18 bg-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]">
              <Image src="/logo.png" alt="Logo" fill className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[1.85rem] font-semibold leading-[0.98] tracking-tight text-white">{labels.site_name || BRAND.name}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-[0.9rem] text-white/68">
                <Sparkles className="h-3.5 w-3.5 text-cyan-200/75" />
                {labels.nav_dashboard || 'Dashboard'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Déconnexion"
            title="Déconnexion"
            onClick={() => {
              clearTenantSession()
              void clearTenantSessionOnServer().finally(() => {
                window.location.href = '/login'
              })
            }}
            className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/18 bg-white/[0.09] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:border-white/30 hover:bg-white/[0.14]"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-5 rounded-[1.45rem] border border-white/10 bg-gradient-to-br from-white/[0.075] via-white/[0.04] to-white/[0.02] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_24px_rgba(4,8,28,0.34)]">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/56">
                <Shield className="h-3.5 w-3.5" />
                Groupe
              </p>
              <p className="mt-2 inline-flex h-8 max-w-full items-center rounded-full border border-amber-300/38 bg-amber-500/22 px-3 text-sm font-semibold text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.18)]"><span className="max-w-[10rem] truncate">{groupName}</span></p>
            </div>

            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/56">
                <PanelsTopLeft className="h-3.5 w-3.5" />
                Type
              </p>
              <p className="mt-2 inline-flex h-8 max-w-full items-center rounded-full border border-amber-300/38 bg-amber-500/22 px-3 text-sm font-semibold text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.18)]"><span className="max-w-[10rem] truncate">PF</span></p>
            </div>

            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/56">
                <Users className="h-3.5 w-3.5" />
                Users
              </p>
              <p className="mt-2 text-sm text-white/72">-</p>
            </div>

            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/56">
                <BadgeCheck className="h-3.5 w-3.5" />
                Rôle
              </p>
              <p className="mt-2 inline-flex h-8 max-w-full items-center rounded-full border border-cyan-300/38 bg-cyan-500/20 px-3 text-sm font-semibold text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.2)]"><span className="max-w-[10rem] truncate">{roleLabel || 'Admin'}</span></p>
            </div>

            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/56">
                <KeyRound className="h-3.5 w-3.5" />
                Licence
              </p>
              <p className={`mt-2 inline-flex h-8 max-w-full items-center rounded-full border px-3 text-sm font-semibold ${accessStatus.className}`}><span className="max-w-[10rem] truncate">{accessStatus.label}</span></p>
            </div>

            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/56">
                <PanelsTopLeft className="h-3.5 w-3.5" />
                Page
              </p>
              <p className="mt-2 inline-flex h-8 max-w-full items-center rounded-full border border-cyan-300/38 bg-cyan-500/20 px-3 text-sm font-semibold text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.18)]"><span className="max-w-[10rem] truncate">{pageContext.label}</span></p>
            </div>
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
            <p className="mt-1 px-1 text-xs font-semibold uppercase tracking-wide text-white/50">Catégorie • Tablette</p>
            <NavItem href="/admin/tablette" label="Items tablette" icon={<Smartphone className="h-5 w-5" />} active={pathname.startsWith('/admin/tablette')} />
            <p className="mt-1 px-1 text-xs font-semibold uppercase tracking-wide text-white/50">Catégorie • Service</p>
            <NavItem href="/admin/service/achat-service-tablette" label="Achat service tablette" icon={<Wallet className="h-5 w-5" />} active={pathname.startsWith('/admin/service/achat-service-tablette')} />
            <NavItem href="/admin/patch-notes" label="Patch notes" icon={<ScrollText className="h-5 w-5" />} active={pathname.startsWith('/admin/patch-notes')} />
            <NavItem href="/admin/logs" label="Logs" icon={<ClipboardList className="h-5 w-5" />} active={pathname.startsWith('/admin/logs')} />
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
              items={userNavLinks.map((link) => ({
                id: link.id,
                element: <NavItem href={link.href} label={link.label} icon={link.icon} active={link.active} />,
              }))}
            />
            {userNavLinks.length === 0 ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">Aucune catégorie autorisée pour ce rôle.</p> : null}
          </>
        )}
      </div>
    </aside>
  )
}
