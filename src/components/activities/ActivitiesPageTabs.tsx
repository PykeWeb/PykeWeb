'use client'

import Link from 'next/link'

export function ActivitiesPageTabs({ active, showChef = true }: { active: 'declaration' | 'chef'; showChef?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/activites"
        className={`inline-flex h-9 items-center rounded-xl border px-3 text-xs font-semibold transition ${active === 'declaration' ? 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100' : 'border-white/12 bg-white/[0.06] text-white/85 hover:bg-white/[0.12]'}`}
      >
        Déclaration activité
      </Link>
      {showChef ? (
        <Link
          href="/activites/gestion-chef"
          className={`inline-flex h-9 items-center rounded-xl border px-3 text-xs font-semibold transition ${active === 'chef' ? 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100' : 'border-white/12 bg-white/[0.06] text-white/85 hover:bg-white/[0.12]'}`}
        >
          Gestion chef
        </Link>
      ) : null}
    </div>
  )
}
