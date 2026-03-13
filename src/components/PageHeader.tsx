'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getTenantSession, isAdminTenantSession } from '@/lib/tenantSession'
import {
  defaultEditableTextStyle,
  normalizeEditableTextStyle,
  normalizePageHeaderContentConfig,
  type EditableTextAlign,
  type EditableTextBlock,
  type EditableTextStyle,
  type PageHeaderContentConfig,
} from '@/lib/types/uiContent'

type PageHeaderSize = 'default' | 'compact'

type EditableTarget = 'title' | 'subtitle' | `extra:${string}`

const titleSizeClass: Record<PageHeaderSize, string> = {
  default: 'text-3xl',
  compact: 'text-2xl',
}

type EditorState = {
  mode: boolean
  selected: EditableTarget | null
  saving: boolean
  saveError: string | null
}

function getDefaultTitleStyle(size: PageHeaderSize): EditableTextStyle {
  return {
    ...defaultEditableTextStyle,
    fontSize: size === 'compact' ? 30 : 36,
    marginTop: 0,
  }
}

function getDefaultSubtitleStyle(): EditableTextStyle {
  return {
    ...defaultEditableTextStyle,
    fontSize: 14,
    color: '#b4bfd2',
    marginTop: 4,
  }
}

function toCssStyle(style: EditableTextStyle) {
  return {
    fontSize: `${style.fontSize}px`,
    color: style.color,
    textAlign: style.align,
    marginTop: `${style.marginTop}px`,
    padding: `${style.padding}px`,
    transform: `translate(${style.x}px, ${style.y}px)`,
  } as const
}

function blockId() {
  return `txt-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

export function PageHeader({
  title,
  subtitle,
  actions,
  size = 'default',
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  size?: PageHeaderSize
}) {
  const pathname = usePathname() || '/'
  const [isAdmin, setIsAdmin] = useState(false)
  const [config, setConfig] = useState<PageHeaderContentConfig>({ extraBlocks: [] })
  const [editor, setEditor] = useState<EditorState>({ mode: false, selected: null, saving: false, saveError: null })

  useEffect(() => {
    const session = getTenantSession()
    setIsAdmin(isAdminTenantSession(session))
  }, [])

  useEffect(() => {
    let active = true
    async function loadConfig() {
      try {
        const res = await fetch(`/api/ui-content?page=${encodeURIComponent(pathname)}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as { config?: unknown }
        if (!active) return
        setConfig(normalizePageHeaderContentConfig(json.config))
      } catch {
        if (!active) return
        setConfig({ extraBlocks: [] })
      }
    }
    void loadConfig()
    return () => {
      active = false
    }
  }, [pathname])

  const titleBlock = useMemo<EditableTextBlock>(() => {
    const base = config.title
    return {
      id: base?.id || 'title',
      content: base?.content?.trim() ? base.content : title,
      style: normalizeEditableTextStyle(base?.style || getDefaultTitleStyle(size)),
    }
  }, [config.title, size, title])

  const subtitleBlock = useMemo<EditableTextBlock | null>(() => {
    if (!subtitle && !config.subtitle?.content?.trim()) return null
    const base = config.subtitle
    return {
      id: base?.id || 'subtitle',
      content: base?.content?.trim() ? base.content : (subtitle || ''),
      style: normalizeEditableTextStyle(base?.style || getDefaultSubtitleStyle()),
    }
  }, [config.subtitle, subtitle])

  function patchTarget(target: EditableTarget, patch: Partial<EditableTextBlock>) {
    setConfig((current) => {
      if (target === 'title') {
        const next: EditableTextBlock = {
          id: current.title?.id || 'title',
          content: patch.content ?? (current.title?.content ?? title),
          style: normalizeEditableTextStyle({ ...(current.title?.style || getDefaultTitleStyle(size)), ...(patch.style || {}) }),
        }
        return { ...current, title: next }
      }
      if (target === 'subtitle') {
        const next: EditableTextBlock = {
          id: current.subtitle?.id || 'subtitle',
          content: patch.content ?? (current.subtitle?.content ?? (subtitle || '')),
          style: normalizeEditableTextStyle({ ...(current.subtitle?.style || getDefaultSubtitleStyle()), ...(patch.style || {}) }),
        }
        return { ...current, subtitle: next }
      }

      const extraId = target.slice('extra:'.length)
      return {
        ...current,
        extraBlocks: current.extraBlocks.map((block) => (
          block.id === extraId
            ? {
                ...block,
                content: patch.content ?? block.content,
                style: normalizeEditableTextStyle({ ...block.style, ...(patch.style || {}) }),
              }
            : block
        )),
      }
    })
  }

  function addNewTextBlock() {
    const next: EditableTextBlock = {
      id: blockId(),
      content: 'Nouveau texte',
      style: normalizeEditableTextStyle({ ...defaultEditableTextStyle, marginTop: 8 }),
    }
    setConfig((curr) => ({ ...curr, extraBlocks: [...curr.extraBlocks, next] }))
    setEditor((curr) => ({ ...curr, selected: `extra:${next.id}` }))
  }

  function deleteSelected() {
    if (!editor.selected || editor.selected === 'title' || editor.selected === 'subtitle') return
    const id = editor.selected.slice('extra:'.length)
    setConfig((curr) => ({ ...curr, extraBlocks: curr.extraBlocks.filter((block) => block.id !== id) }))
    setEditor((curr) => ({ ...curr, selected: null }))
  }

  function selectedBlock(): EditableTextBlock | null {
    if (!editor.selected) return null
    if (editor.selected === 'title') return titleBlock
    if (editor.selected === 'subtitle') return subtitleBlock
    const id = editor.selected.slice('extra:'.length)
    return config.extraBlocks.find((block) => block.id === id) || null
  }

  function updateSelectedStyle<K extends keyof EditableTextStyle>(key: K, raw: EditableTextStyle[K]) {
    const target = editor.selected
    if (!target) return
    const block = selectedBlock()
    if (!block) return
    patchTarget(target, { style: { ...block.style, [key]: raw } })
  }

  async function saveConfig() {
    setEditor((curr) => ({ ...curr, saving: true, saveError: null }))
    try {
      const res = await fetch('/api/admin/ui-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pathname, config }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: 'Sauvegarde impossible' }))) as { error?: string }
        throw new Error(body.error || 'Sauvegarde impossible')
      }
      setEditor((curr) => ({ ...curr, saving: false }))
    } catch (error: unknown) {
      setEditor((curr) => ({ ...curr, saving: false, saveError: error instanceof Error ? error.message : 'Sauvegarde impossible' }))
    }
  }

  function enableDrag(target: EditableTarget) {
    return (event: React.PointerEvent<HTMLDivElement>) => {
      if (!editor.mode) return
      event.preventDefault()
      const startX = event.clientX
      const startY = event.clientY
      const block = target === 'title' ? titleBlock : target === 'subtitle' ? subtitleBlock : config.extraBlocks.find((entry) => entry.id === target.slice('extra:'.length))
      if (!block) return
      const initialX = block.style.x
      const initialY = block.style.y

      const onMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY
        patchTarget(target, {
          style: {
            ...block.style,
            x: Math.round(initialX + deltaX),
            y: Math.round(initialY + deltaY),
          },
        })
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  const selected = selectedBlock()

  return (
    <div className="relative">
      {isAdmin ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditor((curr) => ({ ...curr, mode: !curr.mode, selected: curr.mode ? null : curr.selected }))}
            className={`h-8 rounded-lg border px-3 text-xs ${editor.mode ? 'border-cyan-300/40 bg-cyan-500/20 text-cyan-50' : 'border-white/20 bg-white/10 text-white/80'}`}
          >
            {editor.mode ? 'Mode édition actif' : 'Mode édition'}
          </button>
          {editor.mode ? (
            <>
              <button type="button" onClick={addNewTextBlock} className="h-8 rounded-lg border border-white/20 bg-white/10 px-3 text-xs text-white/85">Ajouter texte</button>
              <button type="button" onClick={() => void saveConfig()} disabled={editor.saving} className="h-8 rounded-lg border border-emerald-300/40 bg-emerald-500/20 px-3 text-xs text-emerald-50">{editor.saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div
            role="button"
            tabIndex={0}
            onPointerDown={enableDrag('title')}
            onClick={() => editor.mode && setEditor((curr) => ({ ...curr, selected: 'title' }))}
            className={`${titleSizeClass[size]} font-semibold tracking-tight ${editor.mode ? 'cursor-move rounded-md border border-dashed border-white/30' : ''}`}
            style={toCssStyle(titleBlock.style)}
            contentEditable={editor.mode && isAdmin}
            suppressContentEditableWarning
            onBlur={(event) => patchTarget('title', { content: event.currentTarget.textContent || title })}
          >
            {titleBlock.content}
          </div>

          {subtitleBlock ? (
            <div
              role="button"
              tabIndex={0}
              onPointerDown={enableDrag('subtitle')}
              onClick={() => editor.mode && setEditor((curr) => ({ ...curr, selected: 'subtitle' }))}
              className={`${editor.mode ? 'cursor-move rounded-md border border-dashed border-white/30' : ''}`}
              style={toCssStyle(subtitleBlock.style)}
              contentEditable={editor.mode && isAdmin}
              suppressContentEditableWarning
              onBlur={(event) => patchTarget('subtitle', { content: event.currentTarget.textContent || '' })}
            >
              {subtitleBlock.content}
            </div>
          ) : null}

          {config.extraBlocks.map((block) => (
            <div
              key={block.id}
              role="button"
              tabIndex={0}
              onPointerDown={enableDrag(`extra:${block.id}`)}
              onClick={() => editor.mode && setEditor((curr) => ({ ...curr, selected: `extra:${block.id}` }))}
              className={`${editor.mode ? 'cursor-move rounded-md border border-dashed border-white/30' : ''}`}
              style={toCssStyle(block.style)}
              contentEditable={editor.mode && isAdmin}
              suppressContentEditableWarning
              onBlur={(event) => patchTarget(`extra:${block.id}`, { content: event.currentTarget.textContent || '' })}
            >
              {block.content}
            </div>
          ))}
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {editor.mode && selected ? (
        <div className="mt-3 w-full max-w-md rounded-xl border border-white/15 bg-[#0f1625]/95 p-3 text-xs shadow-glow">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-white/90">Édition visuelle</p>
            {editor.selected?.startsWith('extra:') ? (
              <button type="button" onClick={deleteSelected} className="rounded-md border border-rose-300/40 bg-rose-500/20 px-2 py-1 text-rose-100">Supprimer</button>
            ) : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-white/70">Taille</span>
              <input type="number" min={10} max={72} value={selected.style.fontSize} onChange={(event) => updateSelectedStyle('fontSize', Number(event.target.value) || 16)} className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-2" />
            </label>
            <label className="space-y-1">
              <span className="text-white/70">Couleur</span>
              <input type="color" value={selected.style.color} onChange={(event) => updateSelectedStyle('color', event.target.value)} className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-1" />
            </label>
            <label className="space-y-1">
              <span className="text-white/70">Alignement</span>
              <select value={selected.style.align} onChange={(event) => updateSelectedStyle('align', event.target.value as EditableTextAlign)} className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-2">
                <option value="left">Gauche</option>
                <option value="center">Centre</option>
                <option value="right">Droite</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-white/70">Margin top</span>
              <input type="number" min={-200} max={200} value={selected.style.marginTop} onChange={(event) => updateSelectedStyle('marginTop', Number(event.target.value) || 0)} className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-2" />
            </label>
            <label className="space-y-1">
              <span className="text-white/70">Padding</span>
              <input type="number" min={0} max={120} value={selected.style.padding} onChange={(event) => updateSelectedStyle('padding', Number(event.target.value) || 0)} className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-2" />
            </label>
            <label className="space-y-1">
              <span className="text-white/70">Position X</span>
              <input type="number" min={-1200} max={1200} value={selected.style.x} onChange={(event) => updateSelectedStyle('x', Number(event.target.value) || 0)} className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-2" />
            </label>
            <label className="space-y-1">
              <span className="text-white/70">Position Y</span>
              <input type="number" min={-1200} max={1200} value={selected.style.y} onChange={(event) => updateSelectedStyle('y', Number(event.target.value) || 0)} className="h-8 w-full rounded-md border border-white/20 bg-white/5 px-2" />
            </label>
          </div>
          {editor.saveError ? <p className="mt-2 text-rose-200">{editor.saveError}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
