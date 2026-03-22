import { Leaf } from 'lucide-react'

export function CokeSessionHeader({
  title,
  subtitle,
  tone = 'cyan',
}: {
  title: string
  subtitle: string
  tone?: 'cyan' | 'amber'
}) {
  const toneClass = tone === 'amber'
    ? 'border-amber-300/25 bg-gradient-to-br from-amber-500/16 to-orange-500/10'
    : 'border-cyan-300/25 bg-gradient-to-br from-cyan-500/16 to-blue-500/10'

  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 ${toneClass}`}>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08]"><Leaf className="h-5 w-5 text-emerald-100" /></div>
      <div>
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-sm text-white/70">{subtitle}</p>
      </div>
    </div>
  )
}
