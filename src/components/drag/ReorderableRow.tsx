'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'

type Item = { id: string; element: ReactNode }

function reorder(list: string[], fromId: string, toId: string) {
  if (fromId === toId) return list
  const from = list.indexOf(fromId)
  const to = list.indexOf(toId)
  if (from === -1 || to === -1) return list
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function ReorderableRow({
  items,
  order,
  editable = true,
  onOrderChange,
  className,
}: {
  items: Item[]
  order: string[]
  editable?: boolean
  onOrderChange: (next: string[]) => void
  className?: string
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [armedId, setArmedId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const pressTimerRef = useRef<number | null>(null)
  const pressStartRef = useRef<{ id: string; x: number; y: number } | null>(null)

  const byId = useMemo(() => new Map(items.map((x) => [x.id, x])), [items])
  const safe = useMemo(() => {
    const ids = items.map((x) => x.id)
    return Array.from(new Set([...order.filter((x) => ids.includes(x)), ...ids]))
  }, [items, order])

  const stopPress = () => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    pressStartRef.current = null
  }

  const startPress = (id: string, x: number, y: number) => {
    if (!editable) return
    stopPress()
    pressStartRef.current = { id, x, y }
    pressTimerRef.current = window.setTimeout(() => {
      setArmedId(id)
      pressTimerRef.current = null
    }, 2000)
  }

  const onPointerMove = (x: number, y: number) => {
    const press = pressStartRef.current
    if (!press || !pressTimerRef.current) return
    const dx = Math.abs(press.x - x)
    const dy = Math.abs(press.y - y)
    if (dx > 10 || dy > 10) stopPress()
  }

  return (
    <div className={className || 'flex flex-wrap gap-2'}>
      {safe.map((id) => {
        const item = byId.get(id)
        if (!item) return null
        const isArmed = armedId === id
        const isDragging = dragging === id
        return (
          <div
            key={id}
            draggable={editable && isArmed}
            onPointerDown={(e) => startPress(id, e.clientX, e.clientY)}
            onPointerUp={() => {
              stopPress()
              if (!isDragging) setArmedId(null)
            }}
            onPointerLeave={stopPress}
            onPointerMove={(e) => onPointerMove(e.clientX, e.clientY)}
            onTouchMove={(e) => {
              const touch = e.touches?.[0]
              if (touch) onPointerMove(touch.clientX, touch.clientY)
            }}
            onDragStart={(e) => {
              if (!editable || !isArmed) {
                e.preventDefault()
                return
              }
              setDragging(id)
              setOverId(id)
            }}
            onDragEnd={() => {
              setDragging(null)
              setOverId(null)
              setArmedId(null)
            }}
            onDragOver={(e) => {
              if (!editable || !dragging) return
              e.preventDefault()
              setOverId(id)
            }}
            onDrop={() => {
              if (!editable || !dragging) return
              onOrderChange(reorder(safe, dragging, id))
              setDragging(null)
              setOverId(null)
              setArmedId(null)
            }}
            className={[
              'rounded-xl transition select-none',
              isArmed ? 'ring-1 ring-cyan-200/50 bg-cyan-300/5' : '',
              isDragging ? 'opacity-55' : 'opacity-100',
              overId === id && dragging && dragging !== id ? 'bg-white/10 ring-1 ring-white/20' : '',
            ].join(' ')}
          >
            {item.element}
          </div>
        )
      })}
    </div>
  )
}
