const titleSizeClass = {
  default: 'text-3xl',
  compact: 'text-2xl',
} as const

type PageHeaderSize = keyof typeof titleSizeClass

export function PageHeader({
  title,
  subtitle,
  actions,
  size = 'default',
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  size?: PageHeaderSize
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <h1 className={`${titleSizeClass[size]} font-semibold tracking-tight`}>{title}</h1>
        {subtitle ? <p className="text-sm text-white/70">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
