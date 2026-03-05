import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anon) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

function canUseLocalStorage() {
  try {
    const k = '__pykestock_test__'
    globalThis.localStorage.setItem(k, '1')
    globalThis.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

// Storage "safe" : ne crash pas si localStorage est bloqué/buggué (FiveM NUI/CEF)
const safeLocalStorage: Storage = {
  getItem: (key) => {
    try {
      return globalThis.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key, value) => {
    try {
      globalThis.localStorage.setItem(key, value)
    } catch {
      // ignore
    }
  },
  removeItem: (key) => {
    try {
      globalThis.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
  key: (index) => {
    try {
      return globalThis.localStorage.key(index)
    } catch {
      return null
    }
  },
  get length() {
    try {
      return globalThis.localStorage.length
    } catch {
      return 0
    }
  },
  clear: () => {
    try {
      globalThis.localStorage.clear()
    } catch {
      // ignore
    }
  },
}

// Fallback mémoire (si localStorage est inutilisable)
const memoryStore = new Map<string, string>()
const memoryStorage: Storage = {
  getItem: (k) => memoryStore.get(k) ?? null,
  setItem: (k, v) => void memoryStore.set(k, v),
  removeItem: (k) => void memoryStore.delete(k),
  key: (i) => Array.from(memoryStore.keys())[i] ?? null,
  get length() {
    return memoryStore.size
  },
  clear: () => void memoryStore.clear(),
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: canUseLocalStorage() ? safeLocalStorage : memoryStorage,
  },
})
