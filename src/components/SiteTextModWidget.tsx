'use client'

import { useEffect, useMemo, useState } from 'react'
import { Settings2 } from 'lucide-react'

const STORAGE_KEY = 'pykeweb:text-overrides:v1'
const ADMIN_USER = 'admin'
const ADMIN_PASSWORD = 'santa1234'

type Overrides = Record<string, string>

function readOverrides(): Overrides {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Overrides) : {}
  } catch {
    return {}
  }
}

function writeOverrides(overrides: Overrides) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

async function readOverridesFromDatabase(): Promise<Overrides> {
  const res = await fetch('/api/ui-texts', { cache: 'no-store' })
  if (!res.ok) return {}
  const data = (await res.json()) as { overrides?: Overrides }
  return data.overrides ?? {}
}

async function upsertOverrideOnline(key: string, value: string): Promise<number> {
  const res = await fetch('/api/admin/ui-texts/upsert', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-user': ADMIN_USER,
      'x-admin-password': ADMIN_PASSWORD,
    },
    body: JSON.stringify({ key, value, scope: 'global' }),
  })
  if (!res.ok) throw new Error(await res.text())
  const body = (await res.json()) as { count?: number }
  return body.count ?? 0
}

async function resetOverridesOnline() {
  const res = await fetch('/api/admin/ui-texts/reset', {
    method: 'POST',
    headers: {
      'x-admin-user': ADMIN_USER,
      'x-admin-password': ADMIN_PASSWORD,
    },
  })
  if (!res.ok) throw new Error(await res.text())
}

function shouldSkipNode(parent: Node | null) {
  if (!parent || !(parent instanceof HTMLElement)) return true
  if (parent.closest('[data-mod-widget="true"]')) return true
  const tag = parent.tagName
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(tag)) return true
  return parent.isContentEditable
}

function applyOverrides(overrides: Overrides) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const textNode = node as Text
    const value = textNode.nodeValue
    if (!value || shouldSkipNode(textNode.parentNode)) {
      node = walker.nextNode()
      continue
    }

    const replacement = overrides[value]
    if (replacement && replacement !== value) textNode.nodeValue = replacement
    node = walker.nextNode()
  }
}

function getEditableText(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null
  if (target.closest('[data-mod-widget="true"]')) return null

  const directTextNode = Array.from(target.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
  )

  if (directTextNode) return { value: directTextNode.textContent ?? '' }

  const descendant = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
  let next = descendant.nextNode()
  while (next) {
    const textNode = next as Text
    const value = textNode.nodeValue ?? ''
    if (value.trim() && !shouldSkipNode(textNode.parentNode)) return { value }
    next = descendant.nextNode()
  }

  return null
}

export function SiteTextModWidget() {
  const [open, setOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [modMode, setModMode] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [overrides, setOverrides] = useState<Overrides>({})
  const [dbStatus, setDbStatus] = useState<string>('Sauvegarde en ligne active')
  const [dbCount, setDbCount] = useState<number>(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const local = readOverrides()
      const remote = await readOverridesFromDatabase()
      if (!alive) return
      const merged = Object.keys(remote).length ? remote : local
      setOverrides(merged)
      writeOverrides(merged)
      setDbCount(Object.keys(remote).length)
      setTimeout(() => applyOverrides(merged), 0)
    })().catch((e) => setDbStatus(`Erreur base : ${e?.message || 'inconnue'}`))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    applyOverrides(overrides)
    const observer = new MutationObserver(() => applyOverrides(overrides))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [overrides])

  useEffect(() => {
    if (!modMode) return
    const onClick = (event: MouseEvent) => {
      const editable = getEditableText(event.target)
      if (!editable) return
      event.preventDefault()
      event.stopPropagation()
      const current = editable.value
      const originalEntry = Object.entries(overrides).find(([, replacement]) => replacement === current)
      const sourceText = originalEntry?.[0] ?? current
      const nextValue = window.prompt('Modifier ce texte :', current)
      if (!nextValue || nextValue === current) return

      const nextOverrides = { ...overrides, [sourceText]: nextValue }
      setOverrides(nextOverrides)
      writeOverrides(nextOverrides)
      void upsertOverrideOnline(sourceText, nextValue)
        .then((count) => {
          setDbStatus('Sauvegarde en ligne active')
          setDbCount(count)
        })
        .catch((e) => setDbStatus(`Erreur base : ${e?.message || 'inconnue'}`))
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [modMode, overrides])

  const overrideCount = useMemo(() => dbCount || Object.keys(overrides).length, [dbCount, overrides])

  const handleLogin = () => {
    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      setIsAdmin(true)
      setLoginError('')
      setPassword('')
      return
    }
    setLoginError('Identifiants invalides.')
  }

  const clearOverrides = () => {
    if (!window.confirm('Réinitialiser tous les textes en base ?')) return
    const cleared = {}
    setOverrides(cleared)
    writeOverrides(cleared)
    void resetOverridesOnline()
      .then(() => {
        setDbStatus('Sauvegarde en ligne active')
        setDbCount(0)
      })
      .catch((e) => setDbStatus(`Erreur base : ${e?.message || 'inconnue'}`))
      .finally(() => window.location.reload())
  }

  return (
    <>
      <button
        data-mod-widget="true"
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-3 right-3 z-[100] inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/70 px-2 py-1 text-[10px] text-white/80 hover:bg-black/90"
      >
        <Settings2 className="h-3 w-3" />
        Mod
      </button>

      {open ? (
        <div
          data-mod-widget="true"
          className="fixed bottom-12 right-3 z-[100] w-72 rounded-xl border border-white/20 bg-slate-950/95 p-3 text-xs text-white shadow-2xl"
        >
          {!isAdmin ? (
            <div className="space-y-2">
              <p className="font-semibold">Connexion admin</p>
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Utilisateur" className="w-full rounded-md border border-white/20 bg-black/50 px-2 py-1" />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mot de passe" className="w-full rounded-md border border-white/20 bg-black/50 px-2 py-1" />
              {loginError ? <p className="text-rose-300">{loginError}</p> : null}
              <button type="button" onClick={handleLogin} className="w-full rounded-md border border-emerald-400/40 bg-emerald-600/20 px-2 py-1 font-medium">Se connecter</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-semibold">Mode modification</p>
              <p className="text-white/70">Textes sauvegardés : {overrideCount}</p>
              <p className="text-[11px] text-cyan-200">{dbStatus}</p>
              <button type="button" onClick={() => setModMode((value) => !value)} className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1">{modMode ? 'Désactiver la modification' : 'Activer la modification'}</button>
              <button type="button" onClick={clearOverrides} className="w-full rounded-md border border-amber-400/40 bg-amber-600/20 px-2 py-1">Réinitialiser les textes</button>
              <button type="button" onClick={() => { setIsAdmin(false); setModMode(false) }} className="w-full rounded-md border border-rose-400/40 bg-rose-600/20 px-2 py-1">Déconnexion</button>
              <p className="text-[11px] text-white/60">Astuce: active le mode puis clique sur un texte pour le modifier.</p>
            </div>
          )}
        </div>
      ) : null}
    </>
  )
}
