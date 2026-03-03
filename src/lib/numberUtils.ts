export function toNumber(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function toNonNegative(value: unknown, fallback = 0) {
  return Math.max(0, toNumber(value, fallback))
}

export function toPositiveInt(value: unknown, fallback = 1) {
  const n = Math.floor(toNumber(value, fallback))
  return Math.max(1, n)
}

export function calcTotal(quantity: unknown, unitPrice: unknown) {
  return toPositiveInt(quantity, 1) * toNonNegative(unitPrice, 0)
}
