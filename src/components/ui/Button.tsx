import clsx from 'clsx'

export function Button({
  children,
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'
  const styles = {
    primary: 'bg-white/10 text-white hover:bg-white/15 border border-white/10 shadow-glow',
    secondary: 'bg-white/[0.06] text-white/90 hover:bg-white/10 border border-white/10',
    ghost: 'bg-transparent text-white/80 hover:bg-white/10 border border-white/10',
  } as const

  return (
    <button className={clsx(base, styles[variant], className)} {...props}>
      {children}
    </button>
  )
}
