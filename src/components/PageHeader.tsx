import type { ReactNode } from 'react'

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
  actions?: ReactNode
  size?: PageHeaderSize
}) {
  void title
  void subtitle
  void size

  if (!actions) return null

  return <div className="flex items-center gap-2">{actions}</div>
}
