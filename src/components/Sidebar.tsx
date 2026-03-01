import Link from 'next/link'
import { LayoutGrid, Package, Crosshair } from 'lucide-react'
import { BRAND } from '@/lib/brand'

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
  return (
    <aside className="hidden w-[280px] shrink-0 flex-col gap-4 md:flex">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/70 to-sky-400/70" />
          <div>
            <p className="text-sm font-semibold leading-tight">{BRAND.name}</p>
            <p className="text-xs text-white/60">{BRAND.tagline}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-xs text-white/60">Utilisateur</p>
          <p className="mt-1 text-sm font-semibold">admin</p>
          <div className="mt-2 inline-flex rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80">
            ADMIN
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <NavItem href="/" label="Dashboard" icon={<LayoutGrid className="h-4 w-4" />} />
        <NavItem href="/objets" label="Objets" icon={<Package className="h-4 w-4" />} />
        <NavItem href="/armes" label="Armes" icon={<Crosshair className="h-4 w-4" />} />
      </div>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60 shadow-glow">
        Version maquette UI • Simple, clean, ready à brancher.
      </div>
    </aside>
  )
}
