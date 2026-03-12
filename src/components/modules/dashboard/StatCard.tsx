import Link from 'next/link'
import { Panel } from '@/components/ui/Panel'
import clsx from 'clsx'

export function StatCard({
  title,
  value,
  icon,
  variant,
  tone = 'slate',
  bubbleStyle,
  href
}: {
  title: string
  value: string
  icon: React.ReactNode
  variant?: 'default' | 'accent'
  tone?: 'slate' | 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose'
  bubbleStyle?: {
    bgColor?: string
    borderColor?: string
    textColor?: string
    iconBgColor?: string
    iconColor?: string
  }
  href?: string
}) {
  const toneClass = {
    slate: 'border-white/15 bg-white/[0.05]',
    cyan: 'border-cyan-300/35 bg-gradient-to-br from-cyan-500/28 to-blue-500/20',
    emerald: 'border-emerald-300/35 bg-gradient-to-br from-emerald-500/28 to-teal-500/20',
    amber: 'border-amber-300/35 bg-gradient-to-br from-amber-500/28 to-orange-500/20',
    violet: 'border-violet-300/35 bg-gradient-to-br from-violet-500/28 to-indigo-500/20',
    rose: 'border-rose-300/35 bg-gradient-to-br from-rose-500/28 to-orange-500/20',
  }[tone]

  const card = (
    <Panel
      className={clsx(
        'h-full',
        toneClass,
        variant === 'accent' && 'bg-gradient-to-br from-white/[0.07] to-white/[0.03]',
        href && 'cursor-pointer transition hover:brightness-110'
      )}
      style={{
        background: bubbleStyle?.bgColor || undefined,
        borderColor: bubbleStyle?.borderColor || undefined,
        color: bubbleStyle?.textColor || undefined,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="min-h-[2.5rem] text-sm text-white/60" style={{ color: bubbleStyle?.textColor ? `${bubbleStyle.textColor}CC` : undefined }}>{title}</p>
          <p className="mt-2 text-3xl font-semibold leading-none">{value}</p>
        </div>
        <div
          className={clsx('grid h-11 w-11 place-items-center rounded-xl border text-white/90', tone === 'cyan' && 'border-cyan-200/45 bg-cyan-500/20', tone === 'emerald' && 'border-emerald-200/45 bg-emerald-500/20', tone === 'amber' && 'border-amber-200/45 bg-amber-500/20', tone === 'violet' && 'border-violet-200/45 bg-violet-500/20', tone === 'rose' && 'border-rose-200/45 bg-rose-500/20', tone === 'slate' && 'border-white/15 bg-white/10')}
          style={{
            background: bubbleStyle?.iconBgColor || undefined,
            color: bubbleStyle?.iconColor || undefined,
            borderColor: bubbleStyle?.borderColor || undefined,
          }}
        >
          {icon}
        </div>
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
