'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const instanceId = useId()

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])



  useEffect(() => {
    const onOpen = (event: Event) => {
      const custom = event as CustomEvent<{ id: string }>
      if (custom.detail?.id !== instanceId) setOpen(false)
    }
    window.addEventListener('glass-select-open', onOpen as EventListener)
    return () => window.removeEventListener('glass-select-open', onOpen as EventListener)
  }, [instanceId])

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div ref={ref} className={clsx('relative z-[60]', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next) window.dispatchEvent(new CustomEvent('glass-select-open', { detail: { id: instanceId } }))
            return next
          })
        }}
        className="flex h-10 w-full items-center justify-between rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-left text-sm text-white/90 transition hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? 'text-white/90' : 'text-white/45'}>{selected?.label || placeholder}</span>
        <ChevronDown className={clsx('h-4 w-4 text-white/70 transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[70] max-h-64 w-full overflow-auto rounded-2xl border border-white/12 bg-[#111b2f]/95 p-1 shadow-2xl backdrop-blur-xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={clsx(
                'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition',
                option.value === value ? 'bg-white/16 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
