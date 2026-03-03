import { BRAND } from '@/lib/constants/brand'

export function DashboardHeader() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
      <p className="text-sm text-white/70">Bienvenue sur</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{BRAND.fullTitle}</h1>
      <p className="mt-2 text-sm text-white/60">
        Pour l’instant : <span className="text-white">Objets</span> seulement. Le reste on ajoutera plus tard.
      </p>
    </div>
  )
}
