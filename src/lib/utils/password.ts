const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?'

type Options = {
  length?: number
  avoidAmbiguous?: boolean
}

function pick(chars: string) {
  return chars[Math.floor(Math.random() * chars.length)]
}

function shuffle(values: string[]) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

export function generatePassword(options: Options = {}) {
  const length = Math.min(32, Math.max(12, options.length ?? 16))
  const ambiguous = /[O0Il1]/g

  const baseSets = [LOWER, UPPER, DIGITS, SYMBOLS].map((s) =>
    options.avoidAmbiguous ? s.replace(ambiguous, '') : s
  )

  const required = baseSets.map((set) => pick(set))
  const pool = baseSets.join('')
  const remaining = Array.from({ length: length - required.length }, () => pick(pool))

  return shuffle([...required, ...remaining]).join('')
}

export async function copyToClipboard(value: string) {
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.setAttribute('readonly', 'true')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      textarea.setSelectionRange(0, textarea.value.length)
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }
}
