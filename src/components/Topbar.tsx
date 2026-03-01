import Link from 'next/link'
import { GROUP } from '@/lib/brand'

export function Topbar() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-white/60">Zone active</p>
        <p className="text-2xl font-semibold">Dashboard</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 shadow-glow md:flex">
          <span className="text-white/60">Groupe :</span>
          <span className="font-semibold text-white">{GROUP.name}</span>
        </div>

        <Link
          href="/"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10"
        >
          Accueil
        </Link>
      </div>
    </div>
  )
}
