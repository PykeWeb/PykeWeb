'use client'

import type { ReactNode } from 'react'
import { ReorderableRow } from '@/components/drag/ReorderableRow'

type Item = { id: string; element: ReactNode }

export function LongPressReorderableRow(props: { items: Item[]; order: string[]; onOrderChange: (next: string[]) => void; className?: string }) {
  return <ReorderableRow {...props} />
}

export function LongPressReorderableGrid(props: { items: Item[]; order: string[]; onOrderChange: (next: string[]) => void; className?: string }) {
  return <ReorderableRow {...props} className={props.className || 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3'} />
}
