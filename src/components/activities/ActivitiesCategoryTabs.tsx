'use client'

import Link from 'next/link'
import { ClipboardList, Smartphone } from 'lucide-react'

type BubbleStats = {
  today?: number
  week?: number
}

export function ActivitiesCategoryTabs({
  active,
  activitiesStats,
  tabletteStats,
}: {
  active: 'activites' | 'tablette'
  activitiesStats?: BubbleStats
  tabletteStats?: BubbleStats
}) {
  const items = [
    {
      key: 'activites' as const,
      href: '/activites',
      label: 'Activités',
      icon: <ClipboardList className="h-5 w-5" />,
      stats: activitiesStats,
    },
    {
      key: 'tablette' as const,
      href: '/tablette',
      label: 'Tablette',
      icon: <Smartphone className="h-5 w-5" />,
      stats: tabletteStats,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const selected = active === item.key
        return (
          <Link
            key={item.key}
            href={item.href}
            className={[
              'group relative overflow-hidden rounded-3xl border p-5 shadow-[0_10px_35px_rgba(0,0,0,0.35)] transition duration-200',
              'hover:scale-[1.02] hover:shadow-[0_15px_45px_rgba(56,189,248,0.18)]',
              selected
                ? 'border-cyan-300/60 bg-gradient-to-br from-cyan-500/28 via-sky-500/18 to-violet-500/22 text-white'
                : 'border-white/20 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 text-white/90 hover:border-cyan-200/35 hover:from-slate-800/90 hover:to-slate-900/90',
            ].join(' ')}
          >
            <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl transition group-hover:bg-cyan-300/20" />
            <div className="pointer-events-none absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-violet-400/10 blur-3xl transition group-hover:bg-violet-400/20" />

            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={[
                    'grid h-11 w-11 place-items-center rounded-2xl border transition',
                    selected
                      ? 'border-cyan-200/70 bg-cyan-400/25 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.35)]'
                      : 'border-white/20 bg-white/10 text-white/80 group-hover:border-cyan-200/40 group-hover:text-cyan-100',
                  ].join(' ')}
                >
                  {item.icon}
                </span>
                <div>
                  <p className="text-base font-semibold tracking-wide">{item.label}</p>
                  <p className={`text-xs ${selected ? 'text-cyan-100/85' : 'text-white/65'}`}>
                    {selected ? 'Section active' : 'Ouvrir la section'}
                  </p>
                </div>
              </div>
              <div className="grid min-w-[132px] gap-2 text-right">
                <div className="rounded-xl border border-white/15 bg-black/20 px-3 py-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-white/70">Aujourd’hui</p>
                  <p className="text-sm font-semibold text-white">{item.stats?.today ?? '—'}</p>
                </div>
                <div className="rounded-xl border border-white/15 bg-black/20 px-3 py-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-white/70">Semaine</p>
                  <p className="text-sm font-semibold text-white">{item.stats?.week ?? '—'}</p>
                </div>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
