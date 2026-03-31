'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Boxes, LifeBuoy, ScrollText, Wallet, Smartphone, ClipboardList, Truck, Pill, LogOut, Shield, KeyRound, PanelsTopLeft, Users, BadgeCheck, Sparkles, BookUser, Loader2, X } from 'lucide-react'
import { BRAND } from '@/lib/constants/brand'
import { useUiSettings } from '@/lib/useUiSettings'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearTenantSession, clearTenantSessionOnServer, getTenantSession, isAdminTenantSession, isMemberTenantSession, isSbTenantSession } from '@/lib/tenantSession'
import { getCurrentGroupAccessInfo } from '@/lib/communicationApi'
import { expandAccessPrefixes } from '@/lib/types/groupRoles'
import clsx from 'clsx'
import { LongPressReorderableRow } from '@/components/drag/LongPressReorderables'
import { getLayoutOrder, saveLayoutOrder } from '@/lib/uiLayoutsApi'
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import { changeMemberPassword } from '@/lib/tenantAuthApi'

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
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [accessInfo, setAccessInfo] = useState<AccessInfo>(null)
  const [navOrder, setNavOrder] = useState(['dashboard', 'finance', 'items', 'annuaire', 'drogues', 'group', 'activites'])
  const [isPwrGroup, setIsPwrGroup] = useState(false)
  const [isSbGroup, setIsSbGroup] = useState(false)
  const [roleLabel, setRoleLabel] = useState('')
  const [memberName, setMemberName] = useState('Boss')
  const [allowedPrefixes, setAllowedPrefixes] = useState<string[]>([])
  const [cashLabel, setCashLabel] = useState('0 $')
  const [hasMemberSessionId, setHasMemberSessionId] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  useEffect(() => {
    const session = getTenantSession()
    const nextGroupName = session?.groupName || 'Groupe'
    const nextGroupBadge = session?.groupBadge || 'GROUPE'
    setGroupName(nextGroupName)
    setIsAdmin(isAdminTenantSession(session))
    setIsMember(isMemberTenantSession(session))
    setHasMemberSessionId(Boolean(session?.memberId))
    setRoleLabel(session?.roleLabel || (session?.role === 'member' ? 'Membre' : session?.role === 'chef' ? 'Boss' : ''))
    setMemberName(session?.memberName || (session?.role === 'chef' ? 'Boss' : session?.roleLabel || 'Membre'))
    setAllowedPrefixes(Array.isArray(session?.allowedPrefixes) ? expandAccessPrefixes(session.allowedPrefixes) : [])
    const scope = `${nextGroupName} ${nextGroupBadge}`.toLowerCase()
    setIsPwrGroup(scope.includes('pwr'))
    setIsSbGroup(isSbTenantSession(session))

    void listCatalogItemsUnified()
      .then((rows) => {
        const cashItem = rows.find((row) => String(row.name || '').trim().toLowerCase() === 'argent')
        const amount = Math.max(0, Number(cashItem?.stock || 0))
        setCashLabel(`${amount.toLocaleString('fr-FR')} $`)
      })
      .catch(() => setCashLabel('—'))
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
    { id: 'finance', href: '/finance', label: labels.nav_finance || 'Finance', icon: <Wallet className="h-5 w-5" />, active: pathname.startsWith('/finance') },
    { id: 'items', href: '/items', label: 'Items', icon: <Boxes className="h-5 w-5" />, active: pathname.startsWith('/items') },
    { id: 'annuaire', href: '/annuaire', label: 'Annuaire', icon: <BookUser className="h-5 w-5" />, active: pathname.startsWith('/annuaire') },
    { id: 'activites', href: '/activites', label: 'Activités', icon: <ClipboardList className="h-5 w-5" />, active: pathname.startsWith('/activites') || pathname.startsWith('/tablette') },
    { id: 'drogues', href: '/drogues', label: labels.nav_drogues || 'Drogues', icon: <Pill className="h-5 w-5" />, active: pathname.startsWith('/drogues') },
  ]

  const hasFullAccess = allowedPrefixes.includes('/')
  const filteredUserLinks = hasFullAccess
    ? defaultUserLinks
    : defaultUserLinks.filter((link) =>
      allowedPrefixes.some((prefix) => {
        if (link.href === '/') return prefix === '/' || prefix === '/dashboard'
        return link.href === prefix || link.href.startsWith(`${prefix}/`)
      })
    )

  const hasExplicitRoleRestrictions = allowedPrefixes.length > 0
  const canOpenPasswordModal = true

  function openPasswordModal() {
    setPasswordError('')
    setPasswordSuccess('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordModalOpen(true)
  }

  const userNavLinks: NavLink[] = isPwrGroup
    ? [{ id: 'pwr-commandes', href: '/pwr/commandes', label: 'Commande', icon: <Truck className="h-5 w-5" />, active: pathname.startsWith('/pwr/commandes') }]
    : filteredUserLinks.length > 0
      ? filteredUserLinks
      : hasExplicitRoleRestrictions
        ? []
        : isMember
          ? [
            { id: 'activites', href: '/activites', label: 'Activités', icon: <ClipboardList className="h-5 w-5" />, active: pathname.startsWith('/activites') || pathname.startsWith('/tablette') },
          ]
          : defaultUserLinks

  return (
    <>
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
          <div className="mt-1 flex shrink-0 flex-col items-end gap-0">
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/18 bg-white/[0.09] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:border-white/30 hover:bg-white/[0.14]"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
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
                Cash
              </p>
              <p className="mt-2 inline-flex h-8 max-w-full items-center rounded-full border border-amber-300/38 bg-amber-500/22 px-3 text-sm font-semibold text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.18)]"><span className="max-w-[10rem] truncate">{cashLabel}</span></p>
            </div>

            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/56">
                <Users className="h-3.5 w-3.5" />
                Users
              </p>
              <p className="mt-2 inline-flex h-8 max-w-full items-center rounded-full border border-white/18 bg-white/[0.08] px-3 text-sm font-semibold text-white/92"><span className="max-w-[10rem] truncate">{memberName || 'Boss'}</span></p>
            </div>

            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/56">
                <BadgeCheck className="h-3.5 w-3.5" />
                Rôle
              </p>
              <p className="mt-2 inline-flex h-8 max-w-full items-center rounded-full border border-cyan-300/38 bg-cyan-500/20 px-3 text-sm font-semibold text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.2)]"><span className="max-w-[10rem] truncate">{roleLabel || 'Boss'}</span></p>
            </div>

            <Link href="/tablette/paiement" className="group flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center transition hover:border-amber-300/35 hover:bg-amber-500/12">
              <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/56">
                <KeyRound className="h-3.5 w-3.5" />
                Licence
              </p>
              <p className={`mt-2 inline-flex h-8 max-w-full items-center rounded-full border px-3 text-sm font-semibold ${accessStatus.className}`}><span className="max-w-[10rem] truncate">{accessStatus.label}</span></p>
            </Link>

            <Link href="/group" className="group flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center transition hover:border-cyan-300/35 hover:bg-cyan-500/12">
              <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/56">
                <PanelsTopLeft className="h-3.5 w-3.5" />
                Gestion
              </p>
              <p className="mt-2 inline-flex h-8 max-w-full items-center rounded-full border border-cyan-300/38 bg-cyan-500/20 px-3 text-sm font-semibold text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.18)]">
                <span className="max-w-[10rem] truncate">Groupe</span>
              </p>
            </Link>
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
            <div className="flex items-center justify-end gap-2">
              <div className="flex-1">
                <NavItem href="/admin/logs" label="Logs" icon={<ClipboardList className="h-5 w-5" />} active={pathname.startsWith('/admin/logs')} />
              </div>
              {canOpenPasswordModal ? (
                <button
                  type="button"
                  aria-label="Changer mot de passe"
                  title="Changer mot de passe"
                  onClick={openPasswordModal}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/18 bg-white/[0.08] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:border-cyan-300/35 hover:bg-cyan-500/15 hover:text-cyan-100"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
              ) : null}
            </div>
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
            {canOpenPasswordModal ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  aria-label="Changer mot de passe"
                  title="Changer mot de passe"
                  onClick={openPasswordModal}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/18 bg-white/[0.08] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:border-cyan-300/35 hover:bg-cyan-500/15 hover:text-cyan-100"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
      </aside>
      {passwordModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0f1634] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.55)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Changer mon mot de passe</h3>
              <p className="mt-1 text-xs text-white/65">Le nouveau mot de passe sera immédiatement visible dans la gestion du groupe.</p>
            </div>
            <button type="button" onClick={() => setPasswordModalOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/80 hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!hasMemberSessionId ? (
            <p className="mb-3 rounded-lg border border-amber-300/35 bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
              Ce compte n&apos;est pas un compte membre. Connecte-toi avec un identifiant membre pour modifier ce mot de passe ici.
            </p>
          ) : null}

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-white/65">Mot de passe actuel</span>
              <input disabled={!hasMemberSessionId} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" className="mt-1 h-10 w-full rounded-xl border border-white/20 bg-black/30 px-3 text-sm text-white focus:border-cyan-300/55 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50" />
            </label>
            <label className="block">
              <span className="text-xs text-white/65">Nouveau mot de passe</span>
              <input disabled={!hasMemberSessionId} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" className="mt-1 h-10 w-full rounded-xl border border-white/20 bg-black/30 px-3 text-sm text-white focus:border-cyan-300/55 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50" />
            </label>
            <label className="block">
              <span className="text-xs text-white/65">Confirmation</span>
              <input disabled={!hasMemberSessionId} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" className="mt-1 h-10 w-full rounded-xl border border-white/20 bg-black/30 px-3 text-sm text-white focus:border-cyan-300/55 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50" />
            </label>
          </div>

          {passwordError ? <p className="mt-3 rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">{passwordError}</p> : null}
          {passwordSuccess ? <p className="mt-3 rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100">{passwordSuccess}</p> : null}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setPasswordModalOpen(false)} className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white/90 hover:bg-white/20">
              Annuler
            </button>
            <button
              type="button"
              disabled={passwordBusy || !hasMemberSessionId}
              onClick={() => {
                setPasswordError('')
                setPasswordSuccess('')
                if (!hasMemberSessionId) {
                  setPasswordError('Ce compte ne permet pas le changement de mot de passe membre.')
                  return
                }
                if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
                  setPasswordError('Tous les champs sont requis.')
                  return
                }
                if (newPassword.trim().length < 6) {
                  setPasswordError('Le nouveau mot de passe doit contenir au moins 6 caractères.')
                  return
                }
                if (newPassword !== confirmPassword) {
                  setPasswordError('La confirmation ne correspond pas au nouveau mot de passe.')
                  return
                }
                setPasswordBusy(true)
                void changeMemberPassword(currentPassword, newPassword)
                  .then(() => {
                    setPasswordSuccess('Mot de passe mis à jour avec succès.')
                    setCurrentPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                  })
                  .catch((error) => setPasswordError(error instanceof Error ? error.message : 'Impossible de modifier le mot de passe.'))
                  .finally(() => setPasswordBusy(false))
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-3 text-sm font-medium text-cyan-50 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {passwordBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </button>
          </div>
        </div>
        </div>
      ) : null}
    </>
  )
}
