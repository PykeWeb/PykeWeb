'use client'

import type { DragEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'

export type DraggableModule = {
  id: string
  title?: string
  element: ReactNode
}

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

export function DraggableModules({
  modules,
  order,
  onOrderChange,
  className,
}: {
  modules: DraggableModule[]
  order: string[]
  onOrderChange: (next: string[]) => void
  className?: string
}) {
  const [dragging, setDragging] = useState<string | null>(null)

  const moduleMap = useMemo(() => {
    const m = new Map<string, DraggableModule>()
    for (const mod of modules) m.set(mod.id, mod)
    return m
  }, [modules])

  const safeOrder = useMemo(() => {
    const ids = modules.map((m) => m.id)
    const cleaned = order.filter((x) => ids.includes(x))
    return Array.from(new Set([...cleaned, ...ids]))
  }, [modules, order])

  return (
    <div className={className || 'grid grid-cols-1 gap-4'}>
      {safeOrder.map((id) => {
        const mod = moduleMap.get(id)
        if (!mod) return null
        return (
          <div
            key={id}
            draggable
            onDragStart={() => setDragging(id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e: DragEvent<HTMLDivElement>) => e.preventDefault()}
            onDrop={() => {
              if (!dragging) return
              const next = reorder(safeOrder, dragging, id)
              onOrderChange(next)
              setDragging(null)
            }}
            className={'transition ' + (dragging === id ? 'opacity-70' : 'opacity-100')}
          >
            {mod.element}
          </div>
        )
      })}
    </div>
  )
}
