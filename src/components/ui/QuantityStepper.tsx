import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { SecondaryButton } from '@/components/ui/design-system'

type Props = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: 'default' | 'sm'
}

export function QuantityStepper({ value, onChange, min = 1, max, size = 'default' }: Props) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const clamp = (next: number) => {
    const floor = Number.isFinite(min) ? min : 1
    const ceil = Number.isFinite(max as number) ? (max as number) : Number.POSITIVE_INFINITY
    return Math.min(ceil, Math.max(floor, next))
  }

  const commitDraft = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setDraft(String(value))
      return
    }
    const parsed = Number(trimmed)
    const nextValue = clamp(Number.isFinite(parsed) ? Math.floor(parsed) : min)
    onChange(nextValue)
    setDraft(String(nextValue))
  }

  const buttonClassName = size === 'sm' ? 'h-7 px-2' : undefined
  const iconClassName = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const inputClassName = size === 'sm' ? 'h-7 w-16 text-[11px]' : 'w-24'

  return (
    <div className="flex items-center gap-2">
      <SecondaryButton type="button" className={buttonClassName} onClick={() => onChange(clamp(value - 1))} icon={<Minus className={iconClassName} />} />
      <Input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commitDraft()
          }
        }}
        className={inputClassName}
        inputMode="numeric"
      />
      <SecondaryButton type="button" className={buttonClassName} onClick={() => onChange(clamp(value + 1))} icon={<Plus className={iconClassName} />} />
    </div>
  )
}
