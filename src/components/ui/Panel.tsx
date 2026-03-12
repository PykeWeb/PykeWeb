import clsx from 'clsx'

export function Panel({ className, children, style }: { className?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className={clsx('rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow', className)} style={style}>
      {children}
    </section>
  )
}
