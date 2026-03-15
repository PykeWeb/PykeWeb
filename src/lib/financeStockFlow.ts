export const STOCK_IN_NOTE_PREFIX = '[STOCK_IN]'
export const STOCK_OUT_NOTE_PREFIX = '[STOCK_OUT]'

export function markStockInNote(note: string) {
  const trimmed = note.trim()
  return `${STOCK_IN_NOTE_PREFIX} ${trimmed}`
}

export function isStockInNote(note: string | null | undefined) {
  if (!note) return false
  return note.trimStart().startsWith(STOCK_IN_NOTE_PREFIX)
}

export function markStockOutNote(note: string) {
  const trimmed = note.trim()
  return `${STOCK_OUT_NOTE_PREFIX} ${trimmed}`
}

export function isStockOutNote(note: string | null | undefined) {
  if (!note) return false
  return note.trimStart().startsWith(STOCK_OUT_NOTE_PREFIX)
}

export function stripStockFlowMarker(note: string | null | undefined) {
  if (!note) return note ?? null
  const trimmed = note.trimStart()
  if (trimmed.startsWith(STOCK_IN_NOTE_PREFIX)) return trimmed.slice(STOCK_IN_NOTE_PREFIX.length).trimStart()
  if (trimmed.startsWith(STOCK_OUT_NOTE_PREFIX)) return trimmed.slice(STOCK_OUT_NOTE_PREFIX.length).trimStart()
  return note
}
