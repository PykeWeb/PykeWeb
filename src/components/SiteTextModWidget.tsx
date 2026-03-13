'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Settings2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { getTenantSession, isAdminTenantSession } from '@/lib/tenantSession'

const STORAGE_KEY = 'pykeweb:text-overrides:v1'

type Overrides = Record<string, string>
type AdminCreds = { username: string; password: string }

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

function buildAdminHeaders(creds: AdminCreds) {
  return {
    'x-admin-user': creds.username,
    'x-admin-password': creds.password,
  }
}

async function verifyAdminCredentialsOnline(creds: AdminCreds) {
  const res = await fetch('/api/admin/mod/verify', {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'POST',
    body: JSON.stringify(creds),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: 'Identifiants invalides' }))) as { error?: string }
    throw new Error(data.error || 'Identifiants invalides')
  }
}

async function upsertOverrideOnline(key: string, value: string, creds: AdminCreds): Promise<number> {
  const res = await fetch('/api/admin/ui-texts/upsert', {
    ...withTenantSessionHeader({
      headers: {
        'Content-Type': 'application/json',
        ...buildAdminHeaders(creds),
      },
    }),
    method: 'POST',
    body: JSON.stringify({ key, value, scope: 'global' }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: 'Sauvegarde impossible' }))) as { error?: string }
    throw new Error(data.error || 'Sauvegarde impossible')
  }
  const body = (await res.json()) as { count?: number }
  return body.count ?? 0
}

async function resetOverridesOnline(creds: AdminCreds) {
  const res = await fetch('/api/admin/ui-texts/reset', {
    ...withTenantSessionHeader({ headers: { ...buildAdminHeaders(creds) } }),
    method: 'POST',
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: 'Réinitialisation impossible' }))) as { error?: string }
    throw new Error(data.error || 'Réinitialisation impossible')
  }
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

  const directTextNode = Array.from(target.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
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
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [overrides, setOverrides] = useState<Overrides>({})
  const [dbStatus, setDbStatus] = useState<string>('Sauvegarde en ligne active')
  const [dbCount, setDbCount] = useState<number>(0)
  const [adminCreds, setAdminCreds] = useState<AdminCreds | null>(null)
  const [editingSourceText, setEditingSourceText] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')

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
    })().catch((error: unknown) => setDbStatus(`Erreur base : ${error instanceof Error ? error.message : 'inconnue'}`))

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
    if (!modMode || !adminCreds) return

    const clickHandler = (event: MouseEvent) => {
      const editable = getEditableText(event.target)
      if (!editable) return
      event.preventDefault()
      event.stopPropagation()
      const current = editable.value
      const originalEntry = Object.entries(overrides).find(([, replacement]) => replacement === current)
      const source = originalEntry?.[0] || current
      setEditingSourceText(source)
      setEditingDraft(current)
    }

    document.addEventListener('click', clickHandler, true)
    return () => document.removeEventListener('click', clickHandler, true)
  }, [modMode, overrides, adminCreds])

  function saveEdit() {
    if (!editingSourceText || !adminCreds) return
    const nextValue = editingDraft
    const nextOverrides = { ...overrides, [editingSourceText]: nextValue }
    setOverrides(nextOverrides)
    writeOverrides(nextOverrides)
    setEditingSourceText(null)
    setEditingDraft('')

    void upsertOverrideOnline(editingSourceText, nextValue, adminCreds)
      .then((count) => {
        setDbStatus('Sauvegarde en ligne active')
        setDbCount(count)
      })
      .catch((error: unknown) => setDbStatus(`Erreur base : ${error instanceof Error ? error.message : 'inconnue'}`))
  }

  const overrideCount = useMemo(() => dbCount || Object.keys(overrides).length, [dbCount, overrides])

  const handleLogin = async () => {
    const creds = { username: username.trim(), password: password.trim() }
    try {
      await verifyAdminCredentialsOnline(creds)
      setIsAdmin(true)
      setAdminCreds(creds)
      setLoginError('')
      setPassword('')
    } catch (error: unknown) {
      setLoginError(error instanceof Error ? error.message : 'Identifiants invalides.')
    }
  }

  const applyClearOverrides = () => {
    if (!adminCreds) return
    const cleared = {}
    setOverrides(cleared)
    writeOverrides(cleared)
    void resetOverridesOnline(adminCreds)
      .then(() => {
        setDbStatus('Sauvegarde en ligne active')
        setDbCount(0)
      })
      .catch((error: unknown) => setDbStatus(`Erreur base : ${error instanceof Error ? error.message : 'inconnue'}`))
      .finally(() => {
        setConfirmResetOpen(false)
        window.location.reload()
      })
  }

  return (
    <>
      <button
        data-mod-widget="true"
        type="button"
        onClick={() => {
          const session = getTenantSession()
          window.location.href = isAdminTenantSession(session) ? '/admin/logs' : '/logs'
        }}
        className="fixed bottom-3 right-16 z-[100] inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/70 px-2 py-1 text-[10px] text-white/80 hover:bg-black/90"
      >
        <ClipboardList className="h-3 w-3" />
        Logs
      </button>

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
        <div data-mod-widget="true" className="fixed bottom-12 right-3 z-[100] w-80 rounded-xl border border-white/20 bg-slate-950/95 p-3 text-xs text-white shadow-2xl">
          {!isAdmin ? (
            <div className="space-y-2">
              <p className="font-semibold">Connexion admin</p>
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Utilisateur" className="w-full rounded-md border border-white/20 bg-black/50 px-2 py-1" />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mot de passe" className="w-full rounded-md border border-white/20 bg-black/50 px-2 py-1" />
              {loginError ? <p className="text-rose-300">{loginError}</p> : null}
              <button type="button" onClick={() => { void handleLogin() }} className="w-full rounded-md border border-emerald-400/40 bg-emerald-600/20 px-2 py-1 font-medium">Se connecter</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-semibold">Mode modification avancé</p>
              <p className="text-white/70">Textes sauvegardés : {overrideCount}</p>
              <p className="text-[11px] text-cyan-200">{dbStatus}</p>
              <button type="button" onClick={() => setModMode((value) => !value)} className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1">{modMode ? 'Désactiver la modification de textes' : 'Activer la modification de textes'}</button>
              <button type="button" onClick={() => setConfirmResetOpen(true)} className="w-full rounded-md border border-rose-400/40 bg-rose-600/20 px-2 py-1">Réinitialiser tous les overrides</button>
              <button type="button" onClick={() => { setIsAdmin(false); setAdminCreds(null); setModMode(false); setOpen(false) }} className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1">Se déconnecter</button>
              <p className="text-[10px] text-white/60">Astuce : active le mode modification puis clique n’importe quel texte à l’écran pour l’éditer.</p>
            </div>
          )}
        </div>
      ) : null}

      {editingSourceText ? (
        <div data-mod-widget="true" className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4" onClick={() => { setEditingSourceText(null); setEditingDraft('') }}>
          <div className="w-full max-w-xl rounded-xl border border-white/20 bg-slate-950/95 p-3 text-xs text-white" onClick={(event) => event.stopPropagation()}>
            <p className="mb-2 font-semibold">Modifier ce texte</p>
            <p className="mb-2 rounded-md border border-white/10 bg-white/5 p-2 text-[11px] text-white/70">Original: {editingSourceText}</p>
            <textarea value={editingDraft} onChange={(event) => setEditingDraft(event.target.value)} className="min-h-[120px] w-full rounded-md border border-white/20 bg-black/50 px-2 py-1.5 text-sm" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => { setEditingSourceText(null); setEditingDraft('') }} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Annuler</button>
              <button type="button" onClick={saveEdit} disabled={!editingDraft.trim()} className="rounded-md border border-emerald-400/40 bg-emerald-600/20 px-3 py-1 disabled:opacity-50">Enregistrer</button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmResetOpen}
        title="Réinitialiser les overrides ?"
        description="Cette action efface tous les overrides personnalisés de textes en base."
        confirmLabel="Réinitialiser"
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={applyClearOverrides}
      />
    </>
  )
}
