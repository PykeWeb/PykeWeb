import clsx from 'clsx'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-white/20',
        className
      )}
      {...props}
    />
  )
}
