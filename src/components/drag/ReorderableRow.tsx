'use client'

import { GripVertical } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

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
  editable,
  onOrderChange,
  className,
}: {
  items: Item[]
  order: string[]
  editable: boolean
  onOrderChange: (next: string[]) => void
  className?: string
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const byId = useMemo(() => new Map(items.map((x) => [x.id, x])), [items])
  const safe = useMemo(() => {
    const ids = items.map((x) => x.id)
    return Array.from(new Set([...order.filter((x) => ids.includes(x)), ...ids]))
  }, [items, order])

  return (
    <div className={className || 'flex flex-wrap gap-2'}>
      {safe.map((id) => {
        const item = byId.get(id)
        if (!item) return null
        return (
          <div
            key={id}
            draggable={editable}
            onDragStart={() => editable && setDragging(id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => editable && e.preventDefault()}
            onDrop={() => {
              if (!editable || !dragging) return
              onOrderChange(reorder(safe, dragging, id))
              setDragging(null)
            }}
            className={dragging === id ? 'opacity-60' : ''}
          >
            <div className="flex items-center gap-1">
              {editable ? <GripVertical className="h-4 w-4 text-white/45" /> : null}
              {item.element}
            </div>
          </div>
        )
      })}
    </div>
  )
}
