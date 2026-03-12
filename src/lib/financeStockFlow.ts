export const STOCK_IN_NOTE_PREFIX = '[STOCK_IN]'

export function markStockInNote(note: string) {
  const trimmed = note.trim()
  return `${STOCK_IN_NOTE_PREFIX} ${trimmed}`
}

export function isStockInNote(note: string | null | undefined) {
  if (!note) return false
  return note.trimStart().startsWith(STOCK_IN_NOTE_PREFIX)
}

export function stripStockFlowMarker(note: string | null | undefined) {
  if (!note) return note ?? null
  if (!isStockInNote(note)) return note
  return note.trimStart().slice(STOCK_IN_NOTE_PREFIX.length).trimStart()
}
