'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ClipboardList, Settings2, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { getTenantSession, isAdminTenantSession } from '@/lib/tenantSession'

const STORAGE_KEY = 'pykeweb:text-overrides:v1'
const VISUAL_EDITOR_KEY = '__visual_editor_state_v1__'

type Overrides = Record<string, string>
type AdminCreds = { username: string; password: string }

type EditableAlign = 'left' | 'center' | 'right'

type VisualStyle = {
  fontSize: number
  color: string
  align: EditableAlign
  marginTop: number
  padding: number
  x: number
  y: number
}

type VisualEntry = {
  id: string
  page: string
  domPath: string
  sourceText: string
  text: string
  style: VisualStyle
}

type ExtraEntry = {
  id: string
  page: string
  text: string
  style: VisualStyle
}

type VisualState = {
  entries: VisualEntry[]
  extra: ExtraEntry[]
}

const defaultStyle: VisualStyle = {
  fontSize: 16,
  color: '#ffffff',
  align: 'left',
  marginTop: 0,
  padding: 0,
  x: 0,
  y: 0,
}

function parsePx(value: string, fallback: number) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toHexColor(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  const match = value.match(/rgba?\(([^)]+)\)/i)
  if (!match) return fallback
  const parts = match[1].split(',').map((chunk) => Number.parseFloat(chunk.trim()))
  const [r, g, b] = parts
  if (![r, g, b].every((part) => Number.isFinite(part))) return fallback
  const clamp = (input: number) => Math.max(0, Math.min(255, Math.round(input)))
  return `#${[clamp(r), clamp(g), clamp(b)].map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

function deriveStyleFromElement(element: HTMLElement): VisualStyle {
  const computed = window.getComputedStyle(element)
  const align: EditableAlign = computed.textAlign === 'center' || computed.textAlign === 'right' ? computed.textAlign : 'left'
  return normalizeStyle({
    fontSize: parsePx(computed.fontSize, defaultStyle.fontSize),
    color: toHexColor(computed.color, defaultStyle.color),
    align,
    marginTop: parsePx(computed.marginTop, defaultStyle.marginTop),
    padding: parsePx(computed.paddingTop, defaultStyle.padding),
    x: 0,
    y: 0,
  })
}

function shouldSkipApplyingStoredStyle(style: VisualStyle, element: HTMLElement) {
  const isDefaultStored =
    style.fontSize === defaultStyle.fontSize
    && style.color.toLowerCase() === defaultStyle.color
    && style.align === defaultStyle.align
    && style.marginTop === defaultStyle.marginTop
    && style.padding === defaultStyle.padding
    && style.x === defaultStyle.x
    && style.y === defaultStyle.y

  if (!isDefaultStored) return false
  return ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

function normalizeStyle(input?: Partial<VisualStyle> | null): VisualStyle {
  return {
    fontSize: clampNumber(Number(input?.fontSize), 10, 72, defaultStyle.fontSize),
    color: typeof input?.color === 'string' && input.color.trim() ? input.color : defaultStyle.color,
    align: input?.align === 'center' || input?.align === 'right' ? input.align : 'left',
    marginTop: clampNumber(Number(input?.marginTop), -200, 200, defaultStyle.marginTop),
    padding: clampNumber(Number(input?.padding), 0, 120, defaultStyle.padding),
    x: clampNumber(Number(input?.x), -1200, 1200, defaultStyle.x),
    y: clampNumber(Number(input?.y), -1200, 1200, defaultStyle.y),
  }
}

function normalizeVisualState(raw: unknown): VisualState {
  if (!raw || typeof raw !== 'object') return { entries: [], extra: [] }
  const src = raw as { entries?: unknown; extra?: unknown }

  const entries = Array.isArray(src.entries)
    ? src.entries
      .map((entry): VisualEntry | null => {
        if (!entry || typeof entry !== 'object') return null
        const item = entry as Partial<VisualEntry>
        if (!item.id || !item.page || !item.domPath || typeof item.text !== 'string' || typeof item.sourceText !== 'string') return null
        return {
          id: item.id,
          page: item.page,
          domPath: item.domPath,
          sourceText: item.sourceText,
          text: item.text,
          style: normalizeStyle(item.style),
        }
      })
      .filter((entry): entry is VisualEntry => Boolean(entry))
    : []

  const extra = Array.isArray(src.extra)
    ? src.extra
      .map((entry): ExtraEntry | null => {
        if (!entry || typeof entry !== 'object') return null
        const item = entry as Partial<ExtraEntry>
        if (!item.id || !item.page || typeof item.text !== 'string') return null
        return {
          id: item.id,
          page: item.page,
          text: item.text,
          style: normalizeStyle(item.style),
        }
      })
      .filter((entry): entry is ExtraEntry => Boolean(entry))
    : []

  return { entries, extra }
}

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


function getInitialVisualState() {
  const initial = readOverrides()
  try {
    const serialized = initial[VISUAL_EDITOR_KEY]
    return normalizeVisualState(typeof serialized === 'string' ? JSON.parse(serialized) : null)
  } catch {
    return { entries: [], extra: [] }
  }
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
  if (parent.closest('[data-mod-source]')) return true
  const tag = parent.tagName
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(tag)) return true
  return parent.isContentEditable
}

function isProtectedModSource(value: string | null | undefined): boolean {
  if (!value) return false
  return (
    value.startsWith('items.type.')
    || value.startsWith('items.category.')
    || value.startsWith('items.row.')
    || value.startsWith('itemForm.type.')
    || value.startsWith('itemForm.category.')
  )
}

function getDomPath(element: HTMLElement): string {
  const segments: string[] = []
  let current: HTMLElement | null = element

  while (current && current.tagName !== 'BODY') {
    const tag = current.tagName.toLowerCase()
    let index = 0
    let sibling = current.previousElementSibling
    while (sibling) {
      if (sibling.tagName.toLowerCase() === tag) index += 1
      sibling = sibling.previousElementSibling
    }
    segments.unshift(`${tag}:nth-of-type(${index + 1})`)
    current = current.parentElement
  }

  return segments.join(' > ')
}

function findElementByDomPath(path: string): HTMLElement | null {
  if (!path.trim()) return null
  try {
    return document.querySelector(path) as HTMLElement | null
  } catch {
    return null
  }
}

function applyVisualStyle(target: HTMLElement, style: VisualStyle) {
  target.style.fontSize = `${style.fontSize}px`
  target.style.color = style.color
  target.style.textAlign = style.align
  target.style.marginTop = `${style.marginTop}px`
  target.style.padding = `${style.padding}px`
  target.style.transform = `translate(${style.x}px, ${style.y}px)`
}

function applyOverrides(overrides: Overrides, visual: VisualState, pathname: string) {
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

  for (const entry of visual.entries) {
    if (entry.page !== pathname) continue
    const element = findElementByDomPath(entry.domPath)
    if (!element) continue

    const forcedSource = element.dataset.modSource?.trim()
    if (forcedSource && forcedSource !== entry.sourceText) continue
    if (isProtectedModSource(forcedSource)) continue
    if (!element.textContent?.includes(entry.sourceText) && !element.textContent?.includes(entry.text)) continue

    element.textContent = entry.text
    if (!shouldSkipApplyingStoredStyle(entry.style, element)) {
      applyVisualStyle(element, entry.style)
    }
  }
}

function getEditableTarget(target: EventTarget | null): { text: string; element: HTMLElement; sourceText?: string } | null {
  if (!(target instanceof HTMLElement)) return null
  if (target.closest('[data-mod-widget="true"]')) return null

  const forcedSourceHost = target.closest('[data-mod-source]') as HTMLElement | null
  const forcedSource = forcedSourceHost?.dataset.modSource?.trim()
  if (isProtectedModSource(forcedSource)) return null

  let current: HTMLElement | null = target
  while (current && current !== document.body) {
    if (current.childNodes.length) {
      const directTextNode = Array.from(current.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      if (directTextNode) {
        return { text: directTextNode.textContent ?? '', element: current, sourceText: forcedSource || undefined }
      }
    }
    current = current.parentElement
  }

  return null
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

export function SiteTextModWidget() {
  const [open, setOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [modMode, setModMode] = useState(false)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [overrides, setOverrides] = useState<Overrides>(() => readOverrides())
  const [visualState, setVisualState] = useState<VisualState>(() => getInitialVisualState())
  const [dbStatus, setDbStatus] = useState<string>('Sauvegarde en ligne active')
  const [dbCount, setDbCount] = useState<number>(0)
  const [adminCreds, setAdminCreds] = useState<AdminCreds | null>(null)
  const [editingEntry, setEditingEntry] = useState<VisualEntry | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [draggingExtraId, setDraggingExtraId] = useState<string | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; initialX: number; initialY: number } | null>(null)
  const applyingOverridesRef = useRef(false)
  const observerQueuedRef = useRef(false)
  const observerRafRef = useRef<number | null>(null)
  const pathname = usePathname() || '/'

  useEffect(() => {
    let alive = true
    ;(async () => {
      const local = readOverrides()
      const res = await fetch('/api/ui-texts', { cache: 'no-store' })
      const remote = res.ok ? ((await res.json()) as { overrides?: Overrides }).overrides ?? {} : {}
      if (!alive) return

      const merged = Object.keys(remote).length ? remote : local
      const visual = normalizeVisualState(
        typeof merged[VISUAL_EDITOR_KEY] === 'string' ? JSON.parse(merged[VISUAL_EDITOR_KEY]) : null
      )
      setVisualState(visual)
      setOverrides(merged)
      writeOverrides(merged)
      setDbCount(Object.keys(remote).length)
      setTimeout(() => {
        if (applyingOverridesRef.current) return
        applyingOverridesRef.current = true
        try {
          applyOverrides(merged, visual, pathname)
        } finally {
          applyingOverridesRef.current = false
        }
      }, 0)
    })().catch((error: unknown) => setDbStatus(`Erreur base : ${error instanceof Error ? error.message : 'inconnue'}`))

    return () => {
      alive = false
    }
  }, [pathname])

  useLayoutEffect(() => {
    const runApply = () => {
      if (applyingOverridesRef.current) return
      applyingOverridesRef.current = true
      try {
        applyOverrides(overrides, visualState, pathname)
      } finally {
        applyingOverridesRef.current = false
      }
    }

    runApply()

    const observer = new MutationObserver(() => {
      if (applyingOverridesRef.current) return
      if (observerQueuedRef.current) return
      observerQueuedRef.current = true
      observerRafRef.current = window.requestAnimationFrame(() => {
        observerQueuedRef.current = false
        runApply()
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (observerRafRef.current !== null) {
        window.cancelAnimationFrame(observerRafRef.current)
        observerRafRef.current = null
      }
      observerQueuedRef.current = false
    }
  }, [overrides, visualState, pathname])

  useEffect(() => {
    if (!modMode || !adminCreds) return

    const clickHandler = (event: MouseEvent) => {
      const editable = getEditableTarget(event.target)
      if (!editable) return
      event.preventDefault()
      event.stopPropagation()

      const current = editable.text
      const domPath = getDomPath(editable.element)
      const stableSource = editable.sourceText || current
      const existing = visualState.entries.find((entry) => entry.page === pathname && entry.domPath === domPath && entry.sourceText === stableSource)
      const entry: VisualEntry = existing ?? {
        id: makeId('entry'),
        page: pathname,
        domPath,
        sourceText: stableSource,
        text: current,
        style: deriveStyleFromElement(editable.element),
      }

      setEditingEntry(entry)
      setEditingDraft(entry.text)
    }

    const pointerMove = (event: PointerEvent) => {
      if (!draggingExtraId || !dragStartRef.current) return
      const deltaX = event.clientX - dragStartRef.current.x
      const deltaY = event.clientY - dragStartRef.current.y
      setVisualState((curr) => ({
        ...curr,
        extra: curr.extra.map((entry) => (
          entry.id === draggingExtraId
            ? {
                ...entry,
                style: normalizeStyle({
                  ...entry.style,
                  x: dragStartRef.current!.initialX + deltaX,
                  y: dragStartRef.current!.initialY + deltaY,
                }),
              }
            : entry
        )),
      }))
    }

    const pointerUp = () => {
      setDraggingExtraId(null)
      dragStartRef.current = null
    }

    document.addEventListener('click', clickHandler, true)
    window.addEventListener('pointermove', pointerMove)
    window.addEventListener('pointerup', pointerUp)

    return () => {
      document.removeEventListener('click', clickHandler, true)
      window.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerup', pointerUp)
    }
  }, [modMode, adminCreds, visualState.entries, draggingExtraId, pathname])

  const overrideCount = useMemo(() => {
    const textCount = Object.keys(overrides).filter((key) => key !== VISUAL_EDITOR_KEY).length
    return dbCount || textCount
  }, [dbCount, overrides])

  const pageExtra = useMemo(() => visualState.extra.filter((entry) => entry.page === pathname), [visualState.extra, pathname])

  const persistVisualState = async (nextState: VisualState) => {
    if (!adminCreds) return
    const serialized = JSON.stringify(nextState)
    const nextOverrides = { ...overrides, [VISUAL_EDITOR_KEY]: serialized }
    setOverrides(nextOverrides)
    writeOverrides(nextOverrides)
    try {
      const count = await upsertOverrideOnline(VISUAL_EDITOR_KEY, serialized, adminCreds)
      setDbStatus('Sauvegarde en ligne active')
      setDbCount(count)
    } catch (error: unknown) {
      setDbStatus(`Erreur base : ${error instanceof Error ? error.message : 'inconnue'}`)
    }
  }

  const saveEntry = async () => {
    if (!editingEntry || !adminCreds) return
    const normalizedEntry: VisualEntry = {
      ...editingEntry,
      text: editingDraft,
      style: normalizeStyle(editingEntry.style),
    }

    const nextState: VisualState = {
      ...visualState,
      entries: [
        ...visualState.entries.filter((entry) => !(entry.id === normalizedEntry.id || (entry.page === normalizedEntry.page && entry.domPath === normalizedEntry.domPath))),
        normalizedEntry,
      ],
    }

    setVisualState(nextState)
    setEditingEntry(null)
    setEditingDraft('')
    await persistVisualState(nextState)
  }

  const removeEntry = async () => {
    if (!editingEntry || !adminCreds) return
    const nextState: VisualState = {
      ...visualState,
      entries: visualState.entries.filter((entry) => entry.id !== editingEntry.id),
    }
    setVisualState(nextState)
    setEditingEntry(null)
    setEditingDraft('')
    await persistVisualState(nextState)
  }


  const saveExtra = async (entry: ExtraEntry) => {
    if (!adminCreds) return
    const nextState: VisualState = {
      ...visualState,
      extra: visualState.extra.map((it) => (it.id === entry.id ? entry : it)),
    }
    setVisualState(nextState)
    await persistVisualState(nextState)
  }

  const removeExtra = async (id: string) => {
    if (!adminCreds) return
    const nextState: VisualState = {
      ...visualState,
      extra: visualState.extra.filter((it) => it.id !== id),
    }
    setVisualState(nextState)
    await persistVisualState(nextState)
  }

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
    setVisualState({ entries: [], extra: [] })
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
      {pageExtra.map((entry) => (
        <div
          key={entry.id}
          data-mod-widget="true"
          onPointerDown={(event) => {
            if (!modMode || !isAdmin) return
            setDraggingExtraId(entry.id)
            dragStartRef.current = {
              x: event.clientX,
              y: event.clientY,
              initialX: entry.style.x,
              initialY: entry.style.y,
            }
          }}
          className={`fixed z-[95] ${modMode && isAdmin ? 'cursor-move' : ''}`}
          style={{
            left: 0,
            top: 0,
            transform: `translate(${entry.style.x}px, ${entry.style.y}px)`,
            fontSize: `${entry.style.fontSize}px`,
            color: entry.style.color,
            textAlign: entry.style.align,
            marginTop: `${entry.style.marginTop}px`,
            padding: `${entry.style.padding}px`,
            maxWidth: '90vw',
          }}
        >
          <div className="rounded-md border border-white/15 bg-black/35 px-2 py-1">
            <div
              contentEditable={modMode && isAdmin}
              suppressContentEditableWarning
              onBlur={(event) => {
                void saveExtra({ ...entry, text: event.currentTarget.textContent || '' })
              }}
            >
              {entry.text}
            </div>
            {modMode && isAdmin ? (
              <button
                type="button"
                onClick={() => { void removeExtra(entry.id) }}
                className="mt-1 inline-flex items-center gap-1 rounded border border-rose-300/40 bg-rose-500/20 px-1.5 py-0.5 text-[10px]"
              >
                <Trash2 className="h-3 w-3" />
                Suppr.
              </button>
            ) : null}
          </div>
        </div>
      ))}

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
              <p className="font-semibold">Mode édition visuelle</p>
              <p className="text-white/70">Textes sauvegardés : {overrideCount}</p>
              <p className="text-[11px] text-cyan-200">{dbStatus}</p>
              <button type="button" onClick={() => setModMode((value) => !value)} className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1">{modMode ? 'Désactiver le mode édition' : 'Activer le mode édition'}</button>
              <button type="button" onClick={() => setConfirmResetOpen(true)} className="w-full rounded-md border border-rose-400/40 bg-rose-600/20 px-2 py-1">Réinitialiser tous les overrides</button>
              <button type="button" onClick={() => { setIsAdmin(false); setAdminCreds(null); setModMode(false); setOpen(false) }} className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1">Se déconnecter</button>
              <p className="text-[10px] text-white/60">Astuce : mode édition actif → clique un texte pour éditer contenu/style et glisse les textes ajoutés.</p>
            </div>
          )}
        </div>
      ) : null}

      {editingEntry ? (
        <div data-mod-widget="true" className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4" onClick={() => { setEditingEntry(null); setEditingDraft('') }}>
          <div className="w-full max-w-xl rounded-xl border border-white/20 bg-slate-950/95 p-3 text-xs text-white" onClick={(event) => event.stopPropagation()}>
            <p className="mb-2 font-semibold">Modifier ce texte</p>
            <p className="mb-2 rounded-md border border-white/10 bg-white/5 p-2 text-[11px] text-white/70">Original: {editingEntry.sourceText}</p>
            <textarea value={editingDraft} onChange={(event) => setEditingDraft(event.target.value)} className="min-h-[120px] w-full rounded-md border border-white/20 bg-black/50 px-2 py-1.5 text-sm" />

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="space-y-1"><span>Taille</span><input type="number" min={10} max={72} value={editingEntry.style.fontSize} onChange={(event) => setEditingEntry((curr) => curr ? ({ ...curr, style: normalizeStyle({ ...curr.style, fontSize: Number(event.target.value) }) }) : curr)} className="w-full rounded border border-white/15 bg-black/40 px-2 py-1" /></label>
              <label className="space-y-1"><span>Couleur</span><input type="color" value={editingEntry.style.color} onChange={(event) => setEditingEntry((curr) => curr ? ({ ...curr, style: normalizeStyle({ ...curr.style, color: event.target.value }) }) : curr)} className="h-8 w-full rounded" /></label>
              <label className="space-y-1"><span>Alignement</span><select value={editingEntry.style.align} onChange={(event) => setEditingEntry((curr) => curr ? ({ ...curr, style: normalizeStyle({ ...curr.style, align: event.target.value as EditableAlign }) }) : curr)} className="w-full rounded border border-white/15 bg-black/40 px-2 py-1"><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></label>
              <label className="space-y-1"><span>Margin top</span><input type="number" min={-200} max={200} value={editingEntry.style.marginTop} onChange={(event) => setEditingEntry((curr) => curr ? ({ ...curr, style: normalizeStyle({ ...curr.style, marginTop: Number(event.target.value) }) }) : curr)} className="w-full rounded border border-white/15 bg-black/40 px-2 py-1" /></label>
              <label className="space-y-1"><span>Padding</span><input type="number" min={0} max={120} value={editingEntry.style.padding} onChange={(event) => setEditingEntry((curr) => curr ? ({ ...curr, style: normalizeStyle({ ...curr.style, padding: Number(event.target.value) }) }) : curr)} className="w-full rounded border border-white/15 bg-black/40 px-2 py-1" /></label>
              <label className="space-y-1"><span>Position X</span><input type="number" min={-1200} max={1200} value={editingEntry.style.x} onChange={(event) => setEditingEntry((curr) => curr ? ({ ...curr, style: normalizeStyle({ ...curr.style, x: Number(event.target.value) }) }) : curr)} className="w-full rounded border border-white/15 bg-black/40 px-2 py-1" /></label>
              <label className="space-y-1"><span>Position Y</span><input type="number" min={-1200} max={1200} value={editingEntry.style.y} onChange={(event) => setEditingEntry((curr) => curr ? ({ ...curr, style: normalizeStyle({ ...curr.style, y: Number(event.target.value) }) }) : curr)} className="w-full rounded border border-white/15 bg-black/40 px-2 py-1" /></label>
            </div>

            <div className="mt-3 flex justify-between gap-2">
              <button type="button" onClick={() => { void removeEntry() }} className="rounded-md border border-rose-400/40 bg-rose-600/20 px-3 py-1 inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />Supprimer</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setEditingEntry(null); setEditingDraft('') }} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Annuler</button>
                <button type="button" onClick={() => { void saveEntry() }} disabled={!editingDraft.trim()} className="rounded-md border border-emerald-400/40 bg-emerald-600/20 px-3 py-1 disabled:opacity-50">Enregistrer</button>
              </div>
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
