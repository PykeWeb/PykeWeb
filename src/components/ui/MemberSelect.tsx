'use client'

import { GlassSelect } from '@/components/ui/GlassSelect'

export function MemberSelect({
  value,
  onChange,
  options,
  placeholder = 'Choisir un joueur',
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <GlassSelect
      value={value}
      onChange={onChange}
      options={options.map((name) => ({ value: name, label: name }))}
      placeholder={placeholder}
    />
  )
}
