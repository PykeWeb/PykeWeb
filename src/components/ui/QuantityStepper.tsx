import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { SecondaryButton } from '@/components/ui/design-system'

type Props = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: 'default' | 'sm'
  fitContent?: boolean
}

export function QuantityStepper({ value, onChange, min = 1, max, size = 'default', fitContent = false }: Props) {
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

  const wrapperClassName = size === 'sm' ? 'gap-1.5' : 'gap-2'
  const buttonClassName = size === 'sm' ? 'h-7 w-7 min-w-7 rounded-lg px-0 text-sm font-semibold leading-none' : undefined
  const inputClassName = size === 'sm' ? 'h-7 px-2 text-center text-[10px]' : 'w-24'
  const fitWidthStyle = fitContent ? { width: `${Math.max(size === 'sm' ? 4 : 3, draft.length + (size === 'sm' ? 2 : 1))}ch` } : undefined

  return (
    <div className={`flex items-center ${wrapperClassName}`}>
      <SecondaryButton type="button" className={buttonClassName} onClick={() => onChange(clamp(value - 1))}>
        −
      </SecondaryButton>
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
        style={fitWidthStyle}
        inputMode="numeric"
      />
      <SecondaryButton type="button" className={buttonClassName} onClick={() => onChange(clamp(value + 1))}>
        +
      </SecondaryButton>
    </div>
  )
}
