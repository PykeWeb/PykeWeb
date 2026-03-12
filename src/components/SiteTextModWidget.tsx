'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, Settings2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { getTenantSession, isAdminTenantSession } from '@/lib/tenantSession'
import {
  buildUiThemeConfigFromOverrides,
  defaultUiThemeConfig,
  UI_THEME_CONFIG_KEY,
  type UiBubbleConfig,
  type UiCustomDashboardBubble,
  type UiThemeConfig,
} from '@/lib/uiThemeConfig'

const STORAGE_KEY = 'pykeweb:text-overrides:v1'

type Overrides = Record<string, string>
type AdminCreds = { username: string; password: string }

const ICON_OPTIONS = [
  'Wallet', 'PlusCircle', 'Receipt', 'Box', 'Shapes', 'Pill', 'Swords', 'Shield', 'ShoppingCart', 'ArrowUpRight', 'ArrowDownRight', 'FolderOpen', 'LayoutGrid',
]

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
    ...withTenantSessionHeader({
      headers: {
        ...buildAdminHeaders(creds),
      },
    }),
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

function createCustomBubble(): UiCustomDashboardBubble {
  return {
    id: `custom-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    title: 'Nouvelle bulle',
    href: '/',
    value: '—',
    icon: 'Shapes',
    bgColor: '#1f2937',
    borderColor: '#374151',
    textColor: '#ffffff',
  }
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
  const [themeConfig, setThemeConfig] = useState<UiThemeConfig>(defaultUiThemeConfig)
  const [themeEditorOpen, setThemeEditorOpen] = useState(false)
  const [dbStatus, setDbStatus] = useState<string>('Sauvegarde en ligne active')
  const [dbCount, setDbCount] = useState<number>(0)
  const [adminCreds, setAdminCreds] = useState<AdminCreds | null>(null)
  const [editingSourceText, setEditingSourceText] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [editingBubbleKey, setEditingBubbleKey] = useState<string | null>(null)
  const [editingBubbleDraft, setEditingBubbleDraft] = useState<UiBubbleConfig>({})
  const themeInitializedRef = useRef(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const local = readOverrides()
      const remote = await readOverridesFromDatabase()
      if (!alive) return
      const merged = Object.keys(remote).length ? remote : local
      setOverrides(merged)
      setThemeConfig(buildUiThemeConfigFromOverrides(merged))
      writeOverrides(merged)
      setDbCount(Object.keys(remote).length)
      setTimeout(() => applyOverrides(merged), 0)
    })().catch((e: unknown) => setDbStatus(`Erreur base : ${e instanceof Error ? e.message : 'inconnue'}`))

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
      const bubbleTarget = (event.target instanceof HTMLElement ? event.target.closest('[data-bubble-key]') : null) as HTMLElement | null
      if (bubbleTarget) {
        const bubbleKey = bubbleTarget.dataset.bubbleKey || ''
        if (bubbleKey) {
          event.preventDefault()
          event.stopPropagation()
          setEditingBubbleKey(bubbleKey)
          setEditingBubbleDraft(themeConfig.bubbles[bubbleKey] || {})
          return
        }
      }

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
  }, [modMode, overrides, adminCreds, themeConfig])

  function saveBubbleEdit() {
    if (!editingBubbleKey) return
    setThemeConfig((curr) => ({
      ...curr,
      bubbles: {
        ...curr.bubbles,
        [editingBubbleKey]: {
          ...(curr.bubbles[editingBubbleKey] || {}),
          ...editingBubbleDraft,
        },
      },
    }))
    setEditingBubbleKey(null)
    setEditingBubbleDraft({})
  }

  useEffect(() => {
    if (!themeInitializedRef.current) {
      themeInitializedRef.current = true
      return
    }
    const serialized = JSON.stringify(themeConfig)
    setOverrides((curr) => {
      const nextOverrides = { ...curr, [UI_THEME_CONFIG_KEY]: serialized }
      writeOverrides(nextOverrides)
      return nextOverrides
    })

    if (!adminCreds || !isAdmin) return

    const timer = window.setTimeout(() => {
      void upsertOverrideOnline(UI_THEME_CONFIG_KEY, serialized, adminCreds)
        .then((count) => {
          setDbStatus('Sauvegarde bulles en ligne active')
          setDbCount(count)
        })
        .catch((e: unknown) => setDbStatus(`Erreur base : ${e instanceof Error ? e.message : 'inconnue'}`))
    }, 500)

    return () => window.clearTimeout(timer)
  }, [themeConfig, adminCreds, isAdmin])

  function updateBubble(key: string, field: keyof UiBubbleConfig, value: string | number) {
    const normalizedValue = (field === 'minWidthPx' || field === 'minHeightPx')
      ? Math.max(0, Number(value) || 0)
      : value
    setThemeConfig((curr) => ({
      ...curr,
      bubbles: {
        ...curr.bubbles,
        [key]: {
          ...(curr.bubbles[key] || {}),
          [field]: normalizedValue,
        },
      },
    }))
  }

  function removeBubble(key: string) {
    setThemeConfig((curr) => {
      const next = { ...curr.bubbles }
      delete next[key]
      return { ...curr, bubbles: next }
    })
  }

  function addBubble() {
    const key = `dashboard.card.custom-${Date.now()}`
    updateBubble(key, 'label', 'Nouvelle bulle')
  }

  function updateCustomBubble(id: string, field: keyof UiCustomDashboardBubble, value: string) {
    setThemeConfig((curr) => ({
      ...curr,
      customDashboardBubbles: curr.customDashboardBubbles.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)),
    }))
  }

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
      .catch((e: unknown) => setDbStatus(`Erreur base : ${e instanceof Error ? e.message : 'inconnue'}`))
  }

  const overrideCount = useMemo(() => {
    const textCount = Object.keys(overrides).filter((key) => key !== UI_THEME_CONFIG_KEY).length
    return dbCount || textCount
  }, [dbCount, overrides])

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
    setThemeConfig(defaultUiThemeConfig)
    writeOverrides(cleared)
    void resetOverridesOnline(adminCreds)
      .then(() => {
        setDbStatus('Sauvegarde en ligne active')
        setDbCount(0)
      })
      .catch((e: unknown) => setDbStatus(`Erreur base : ${e instanceof Error ? e.message : 'inconnue'}`))
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
              <button type="button" onClick={() => setThemeEditorOpen(true)} className="w-full rounded-md border border-indigo-400/40 bg-indigo-600/20 px-2 py-1 font-semibold">Ouvrir le studio Bulles & Icônes</button>
              <button type="button" onClick={() => setConfirmResetOpen(true)} className="w-full rounded-md border border-amber-400/40 bg-amber-600/20 px-2 py-1">Réinitialiser les overrides</button>
              <button type="button" onClick={() => { setIsAdmin(false); setModMode(false); setAdminCreds(null) }} className="w-full rounded-md border border-rose-400/40 bg-rose-600/20 px-2 py-1">Déconnexion</button>
              <p className="text-[11px] text-white/60">Astuce: en mode texte actif, clique sur un texte pour le modifier.</p>
            </div>
          )}
        </div>
      ) : null}

      {themeEditorOpen ? (
        <div data-mod-widget="true" className="fixed inset-0 z-[140] bg-black/75 p-4" onClick={() => setThemeEditorOpen(false)}>
          <div className="mx-auto h-full w-full max-w-6xl overflow-auto rounded-2xl border border-white/20 bg-slate-950/95 p-4 text-xs text-white" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">Studio Bulles & Icônes (admin)</p>
                <p className="text-white/60">Palette globale, icônes, ajout de bulles dashboard. Sauvegarde en direct.</p>
              </div>
              <button type="button" onClick={() => setThemeEditorOpen(false)} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Fermer</button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-white/15 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">Bulles existantes</p>
                  <button type="button" onClick={addBubble} className="rounded-md border border-emerald-400/40 bg-emerald-600/20 px-2 py-1">+ Ajouter clé bulle</button>
                </div>
                <div className="space-y-2">
                  {Object.keys(themeConfig.bubbles).sort().map((key) => {
                    const entry = themeConfig.bubbles[key]
                    return (
                      <div key={key} className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <input value={key} readOnly className="w-full rounded border border-white/15 bg-black/40 px-2 py-1 text-[11px]" />
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <input value={entry.label || ''} onChange={(e) => updateBubble(key, 'label', e.target.value)} placeholder="Label" className="rounded border border-white/15 bg-black/40 px-2 py-1" />
                          <select value={entry.icon || ''} onChange={(e) => updateBubble(key, 'icon', e.target.value)} className="rounded border border-white/15 bg-black/40 px-2 py-1">
                            <option value="">Icône par défaut</option>
                            {ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                          </select>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <label className="text-[11px]">Fond<input type="color" value={entry.bgColor || '#1f2937'} onChange={(e) => updateBubble(key, 'bgColor', e.target.value)} className="mt-1 h-8 w-full rounded" /></label>
                          <label className="text-[11px]">Bordure<input type="color" value={entry.borderColor || '#374151'} onChange={(e) => updateBubble(key, 'borderColor', e.target.value)} className="mt-1 h-8 w-full rounded" /></label>
                          <label className="text-[11px]">Texte<input type="color" value={entry.textColor || '#ffffff'} onChange={(e) => updateBubble(key, 'textColor', e.target.value)} className="mt-1 h-8 w-full rounded" /></label>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <input type="number" min={0} value={entry.minWidthPx ?? ''} onChange={(e) => updateBubble(key, 'minWidthPx', Math.max(0, Number(e.target.value) || 0))} placeholder="Largeur min (px)" className="rounded border border-white/15 bg-black/40 px-2 py-1" />
                          <input type="number" min={0} value={entry.minHeightPx ?? ''} onChange={(e) => updateBubble(key, 'minHeightPx', Math.max(0, Number(e.target.value) || 0))} placeholder="Hauteur min (px)" className="rounded border border-white/15 bg-black/40 px-2 py-1" />
                        </div>
                        <button type="button" onClick={() => removeBubble(key)} className="mt-2 rounded-md border border-rose-400/40 bg-rose-600/20 px-2 py-1">Supprimer cette clé</button>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-xl border border-white/15 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">Nouvelles bulles dashboard</p>
                  <button type="button" onClick={() => setThemeConfig((curr) => ({ ...curr, customDashboardBubbles: [...curr.customDashboardBubbles, createCustomBubble()] }))} className="rounded-md border border-cyan-400/40 bg-cyan-600/20 px-2 py-1">+ Ajouter bulle</button>
                </div>
                <div className="space-y-2">
                  {themeConfig.customDashboardBubbles.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input value={entry.title} onChange={(e) => updateCustomBubble(entry.id, 'title', e.target.value)} placeholder="Titre" className="rounded border border-white/15 bg-black/40 px-2 py-1" />
                        <input value={entry.href} onChange={(e) => updateCustomBubble(entry.id, 'href', e.target.value)} placeholder="Lien" className="rounded border border-white/15 bg-black/40 px-2 py-1" />
                        <input value={entry.value || ''} onChange={(e) => updateCustomBubble(entry.id, 'value', e.target.value)} placeholder="Valeur affichée" className="rounded border border-white/15 bg-black/40 px-2 py-1" />
                        <select value={entry.icon || ''} onChange={(e) => updateCustomBubble(entry.id, 'icon', e.target.value)} className="rounded border border-white/15 bg-black/40 px-2 py-1">
                          {ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                        </select>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <label className="text-[11px]">Fond<input type="color" value={entry.bgColor || '#1f2937'} onChange={(e) => updateCustomBubble(entry.id, 'bgColor', e.target.value)} className="mt-1 h-8 w-full rounded" /></label>
                        <label className="text-[11px]">Bordure<input type="color" value={entry.borderColor || '#374151'} onChange={(e) => updateCustomBubble(entry.id, 'borderColor', e.target.value)} className="mt-1 h-8 w-full rounded" /></label>
                        <label className="text-[11px]">Texte<input type="color" value={entry.textColor || '#ffffff'} onChange={(e) => updateCustomBubble(entry.id, 'textColor', e.target.value)} className="mt-1 h-8 w-full rounded" /></label>
                      </div>
                      <button type="button" onClick={() => setThemeConfig((curr) => ({ ...curr, customDashboardBubbles: curr.customDashboardBubbles.filter((it) => it.id !== entry.id) }))} className="mt-2 rounded-md border border-rose-400/40 bg-rose-600/20 px-2 py-1">Supprimer</button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
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

      {editingBubbleKey ? (
        <div data-mod-widget="true" className="fixed inset-0 z-[125] grid place-items-center bg-black/70 p-4" onClick={() => { setEditingBubbleKey(null); setEditingBubbleDraft({}) }}>
          <div className="w-full max-w-xl rounded-xl border border-white/20 bg-slate-950/95 p-3 text-xs text-white" onClick={(event) => event.stopPropagation()}>
            <p className="mb-2 font-semibold">Modifier la bulle</p>
            <p className="mb-2 rounded-md border border-white/10 bg-white/5 p-2 text-[11px] text-white/70">Clé: {editingBubbleKey}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={editingBubbleDraft.label || ''} onChange={(e) => setEditingBubbleDraft((curr) => ({ ...curr, label: e.target.value }))} placeholder="Label" className="rounded border border-white/15 bg-black/40 px-2 py-1" />
              <select value={editingBubbleDraft.icon || ''} onChange={(e) => setEditingBubbleDraft((curr) => ({ ...curr, icon: e.target.value || undefined }))} className="rounded border border-white/15 bg-black/40 px-2 py-1">
                <option value="">Icône par défaut</option>
                {ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
              </select>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-[11px]">Fond<input type="color" value={editingBubbleDraft.bgColor || '#1f2937'} onChange={(e) => setEditingBubbleDraft((curr) => ({ ...curr, bgColor: e.target.value }))} className="mt-1 h-8 w-full rounded" /></label>
              <label className="text-[11px]">Bordure<input type="color" value={editingBubbleDraft.borderColor || '#374151'} onChange={(e) => setEditingBubbleDraft((curr) => ({ ...curr, borderColor: e.target.value }))} className="mt-1 h-8 w-full rounded" /></label>
              <label className="text-[11px]">Texte<input type="color" value={editingBubbleDraft.textColor || '#ffffff'} onChange={(e) => setEditingBubbleDraft((curr) => ({ ...curr, textColor: e.target.value }))} className="mt-1 h-8 w-full rounded" /></label>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input type="number" min={0} value={editingBubbleDraft.minWidthPx ?? ''} onChange={(e) => setEditingBubbleDraft((curr) => ({ ...curr, minWidthPx: Math.max(0, Number(e.target.value) || 0) }))} placeholder="Largeur min (px)" className="rounded border border-white/15 bg-black/40 px-2 py-1" />
              <input type="number" min={0} value={editingBubbleDraft.minHeightPx ?? ''} onChange={(e) => setEditingBubbleDraft((curr) => ({ ...curr, minHeightPx: Math.max(0, Number(e.target.value) || 0) }))} placeholder="Hauteur min (px)" className="rounded border border-white/15 bg-black/40 px-2 py-1" />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => { setEditingBubbleKey(null); setEditingBubbleDraft({}) }} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Annuler</button>
              <button type="button" onClick={saveBubbleEdit} className="rounded-md border border-emerald-400/40 bg-emerald-600/20 px-3 py-1">Enregistrer</button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmResetOpen}
        title="Réinitialiser les overrides ?"
        description="Cette action efface tous les overrides personnalisés (textes + bulles) en base."
        confirmLabel="Réinitialiser"
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={applyClearOverrides}
      />
    </>
  )
}
