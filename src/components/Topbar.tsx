import Link from 'next/link'

export function Topbar() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-white/60">Zone active</p>
        <p className="text-2xl font-semibold">Dashboard</p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10"
        >
          Accueil
        </Link>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 shadow-glow">
          Mode modification: <span className="font-semibold text-white">OFF</span>
        </div>
      </div>
    </div>
  )
}
