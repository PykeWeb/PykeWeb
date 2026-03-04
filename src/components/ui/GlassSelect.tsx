'use client'

import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

type Option = { value: string; label: string }

export function GlassSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner',
  className,
  disabled,
}: {
  value?: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const hasValue = value != null && options.some((o) => o.value === value)

  return (
    <div className={clsx('relative', className)}>
      <select
        value={hasValue ? value : ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-2xl border border-white/12 bg-white/[0.06] px-4 pr-10 text-sm text-white/90 transition hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {!hasValue ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#111b2f] text-white">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
    </div>
  )
}
