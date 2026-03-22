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
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => {
        const selected = active === item.key
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`rounded-2xl border p-3 shadow-glow transition ${selected ? 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100' : 'border-white/12 bg-white/[0.06] text-white/85 hover:bg-white/[0.12]'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${selected ? 'bg-cyan-500/30' : 'bg-white/10'}`}>{item.icon}</span>
                <p className="text-sm font-semibold">{item.label}</p>
              </div>
              <div className="text-right text-xs">
                <p>Aujourd’hui: <span className="font-semibold">{item.stats?.today ?? '—'}</span></p>
                <p>Semaine: <span className="font-semibold">{item.stats?.week ?? '—'}</span></p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
