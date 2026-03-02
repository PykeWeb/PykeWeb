'use client'

import Image from 'next/image'
import Link from 'next/link'
import { LayoutGrid, Package, Crosshair, Wrench, Leaf, Receipt } from 'lucide-react'
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
  const { labels } = useUiSettings()

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col gap-4 md:flex">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <Image src="/logo.png" alt="Logo" fill className="object-cover" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{labels.site_name || BRAND.name}</p>
            <p className="text-xs text-white/60">{labels.site_tagline || BRAND.tagline}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-xs text-white/60">Groupe</p>
          <p className="mt-1 text-sm font-semibold">{GROUP.name}</p>
          <div className="mt-2 inline-flex rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80">
            {GROUP.badge}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <NavItem href="/" label={labels.nav_dashboard || 'Dashboard'} icon={<LayoutGrid className="h-4 w-4" />} />
        <NavItem href="/objets" label={labels.nav_objets || 'Objets'} icon={<Package className="h-4 w-4" />} />
        <NavItem href="/armes" label={labels.nav_armes || 'Armes'} icon={<Crosshair className="h-4 w-4" />} />
        <NavItem href="/equipement" label={labels.nav_equipement || 'Équipement'} icon={<Wrench className="h-4 w-4" />} />
        <NavItem href="/drogues" label={labels.nav_drogues || 'Drogues'} icon={<Leaf className="h-4 w-4" />} />
        <NavItem href="/depenses" label={labels.nav_depenses || 'Dépenses'} icon={<Receipt className="h-4 w-4" />} />
      </div>

    </aside>
  )
}
