import Link from 'next/link'
import { Panel } from '@/components/ui/Panel'
import clsx from 'clsx'

export function StatCard({
  title,
  value,
  icon,
  variant,
  href
}: {
  title: string
  value: string
  icon: React.ReactNode
  variant?: 'default' | 'accent'
  href?: string
}) {
  const card = (
    <Panel
      className={clsx(
        'h-full',
        variant === 'accent' && 'bg-gradient-to-br from-white/[0.07] to-white/[0.03]',
        href && 'cursor-pointer transition hover:bg-white/[0.07]'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="min-h-[2.5rem] text-sm text-white/60">{title}</p>
          <p className="mt-2 text-3xl font-semibold leading-none">{value}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white/80">{icon}</div>
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
