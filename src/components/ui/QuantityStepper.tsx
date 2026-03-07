import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { SecondaryButton } from '@/components/ui/design-system'

type Props = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function QuantityStepper({ value, onChange, min = 1, max }: Props) {
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

  return (
    <div className="flex items-center gap-2">
      <SecondaryButton type="button" onClick={() => onChange(clamp(value - 1))} icon={<Minus className="h-4 w-4" />} />
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
        className="w-24"
        inputMode="numeric"
      />
      <SecondaryButton type="button" onClick={() => onChange(clamp(value + 1))} icon={<Plus className="h-4 w-4" />} />
    </div>
  )
}
