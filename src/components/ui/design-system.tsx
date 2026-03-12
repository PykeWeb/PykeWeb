import clsx from 'clsx'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Search } from 'lucide-react'

type BaseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  fullWidth?: boolean
  size?: 'md' | 'lg'
}

function baseButtonClass(size: 'md' | 'lg' = 'md', fullWidth?: boolean) {
  return clsx(
    'inline-flex items-center justify-center gap-2.5 rounded-2xl border px-4 font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-55',
    size === 'lg' ? 'h-11 text-[15px]' : 'h-10 text-sm',
    fullWidth && 'w-full'
  )
}

export function PrimaryButton({ className, icon, children, fullWidth, size = 'md', ...props }: BaseButtonProps) {
  return (
    <button className={clsx(baseButtonClass(size, fullWidth), 'border-cyan-300/35 bg-gradient-to-r from-cyan-500/30 to-indigo-500/30 text-white hover:from-cyan-500/45 hover:to-indigo-500/45', className)} {...props}>
      {icon}
      {children}
    </button>
  )
}

export function SecondaryButton({ className, icon, children, fullWidth, size = 'md', ...props }: BaseButtonProps) {
  return (
    <button className={clsx(baseButtonClass(size, fullWidth), 'border-sky-300/20 bg-slate-700/45 text-white/90 hover:border-sky-300/35 hover:bg-slate-600/55', className)} {...props}>
      {icon}
      {children}
    </button>
  )
}

export function GhostButton({ className, icon, children, fullWidth, size = 'md', ...props }: BaseButtonProps) {
  return (
    <button className={clsx(baseButtonClass(size, fullWidth), 'border-white/10 bg-transparent text-white/80 hover:bg-white/[0.08]', className)} {...props}>
      {icon}
      {children}
    </button>
  )
}

export function DangerButton({ className, icon, children, fullWidth, size = 'md', ...props }: BaseButtonProps) {
  return (
    <button
      className={clsx(baseButtonClass(size, fullWidth), 'border-rose-300/60 bg-gradient-to-r from-rose-600/45 to-orange-500/35 text-rose-50 shadow-[0_0_0_1px_rgba(251,113,133,0.22)_inset] hover:from-rose-500/60 hover:to-orange-500/45', className)}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({ className, icon, children, ...props }: BaseButtonProps) {
  return (
    <button className={clsx(baseButtonClass('md'), 'min-w-10 border-white/15 bg-white/[0.06] text-white/90 hover:bg-white/[0.1]', className)} {...props}>
      {icon}
      {children}
    </button>
  )
}

export function TabPill({ active, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={clsx(
        'inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-cyan-300/45',
        active
          ? 'border-cyan-300/60 bg-gradient-to-r from-cyan-500/40 to-blue-500/35 text-cyan-50 shadow-[0_0_0_1px_rgba(56,189,248,0.28)_inset]'
          : 'border-white/12 bg-white/[0.04] text-white/75 hover:border-cyan-300/30 hover:bg-cyan-500/[0.08] hover:text-white',
        className
      )}
      {...props}
    />
  )
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      {options.map((option) => (
        <TabPill key={option.value} active={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </TabPill>
      ))}
    </div>
  )
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={clsx('relative block w-full max-w-md', className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
      <input
        className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/40 transition focus:border-white/30 focus:bg-white/[0.1]"
        {...props}
      />
    </label>
  )
}
