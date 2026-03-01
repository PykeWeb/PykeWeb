'use client'

import Image from 'next/image'
import Link from 'next/link'
import { LayoutGrid, Package, Crosshair, Wrench, Leaf, Receipt, Settings } from 'lucide-react'
import { BRAND, GROUP } from '@/lib/brand'
import { useUiSettings } from '@/lib/useUiSettings'

const NavItem = ({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) => {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium shadow-glow transition hover:bg-white/10"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/90">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

export function Sidebar() {
  const { t } = useUiSettings()
  const brandName = t('brand.name', BRAND.name)

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col gap-4 md:flex">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 overflow-hidden rounded-xl bg-black/30">
            <Image src="/logo.png" alt={brandName} fill className="object-contain p-1.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{brandName}</div>
            <div className="truncate text-xs text-white/60">
              {GROUP.badge} • {GROUP.name}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-3">
        <NavItem href="/" label={t('nav.dashboard', 'Dashboard')} icon={<LayoutGrid className="h-5 w-5" />} />
        <NavItem href="/objets" label={t('nav.objets', 'Objets')} icon={<Package className="h-5 w-5" />} />
        <NavItem href="/armes" label={t('nav.armes', 'Armes')} icon={<Crosshair className="h-5 w-5" />} />
        <NavItem href="/equipement" label={t('nav.equipement', 'Équipement')} icon={<Wrench className="h-5 w-5" />} />
        <NavItem href="/drogues" label={t('nav.drogues', 'Drogues')} icon={<Leaf className="h-5 w-5" />} />
        <NavItem href="/depenses" label={t('nav.depenses', 'Dépenses')} icon={<Receipt className="h-5 w-5" />} />
        <NavItem href="/reglages" label={t('nav.reglages', 'Réglages')} icon={<Settings className="h-5 w-5" />} />
      </nav>
    </aside>
  )
}
