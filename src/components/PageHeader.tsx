import type { ReactNode } from 'react'

export function PageHeader({ actions }: { title: string; subtitle?: string; actions?: ReactNode; size?: 'default' | 'compact' }) {
  if (!actions) return null
  return <div className="flex items-center gap-2">{actions}</div>
}
