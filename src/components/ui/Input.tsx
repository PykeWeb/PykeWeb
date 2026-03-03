import clsx from 'clsx'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-white/40 transition focus:border-white/30 focus:bg-white/[0.1]',
        className
      )}
      {...props}
    />
  )
}
