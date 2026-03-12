import Link from 'next/link'
import { Panel } from '@/components/ui/Panel'
import clsx from 'clsx'

export function StatCard({
  title,
  value,
  icon,
  variant,
  tone = 'slate',
  href
}: {
  title: string
  value: string
  icon: React.ReactNode
  variant?: 'default' | 'accent'
  tone?: 'slate' | 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose'
  href?: string
}) {
  const toneClass = {
    slate: 'border-white/10 bg-white/[0.03]',
    cyan: 'border-cyan-300/25 bg-gradient-to-br from-cyan-500/16 to-blue-500/10',
    emerald: 'border-emerald-300/25 bg-gradient-to-br from-emerald-500/16 to-teal-500/10',
    amber: 'border-amber-300/25 bg-gradient-to-br from-amber-500/16 to-orange-500/10',
    violet: 'border-violet-300/25 bg-gradient-to-br from-violet-500/16 to-indigo-500/10',
    rose: 'border-rose-300/25 bg-gradient-to-br from-rose-500/16 to-orange-500/10',
  }[tone]

  const card = (
    <Panel
      className={clsx(
        'h-full',
        toneClass,
        variant === 'accent' && 'bg-gradient-to-br from-white/[0.07] to-white/[0.03]',
        href && 'cursor-pointer transition hover:brightness-110'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="min-h-[2.5rem] text-sm text-white/60">{title}</p>
          <p className="mt-2 text-3xl font-semibold leading-none">{value}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-white/10 text-white/90">{icon}</div>
      </div>
    </Panel>
  )

  if (!href) return card

  return (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  )
}
