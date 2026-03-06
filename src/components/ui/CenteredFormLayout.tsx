import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Panel } from '@/components/ui/Panel'

type ActionPlacement = 'top-right' | 'bottom-right'

export function CenteredFormLayout({
  title,
  subtitle,
  actions,
  children,
  className,
  panelClassName,
  actionsPlacement = 'bottom-right',
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  panelClassName?: string
  actionsPlacement?: ActionPlacement
}) {
  return (
    <div className={clsx('mx-auto w-full max-w-6xl', className)}>
      <Panel className={panelClassName}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-white/65">{subtitle}</p> : null}
          </div>
          {actions && actionsPlacement === 'top-right' ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>

        <div className="mt-4">{children}</div>

        {actions && actionsPlacement === 'bottom-right' ? <div className="mt-4 flex justify-end gap-2">{actions}</div> : null}
      </Panel>
    </div>
  )
}
