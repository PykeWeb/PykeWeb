'use client'

import { useMemo, useState, type ClipboardEvent } from 'react'
import Link from 'next/link'
import { Clipboard, ClipboardCheck, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton, SearchInput, SecondaryButton, TabPill } from '@/components/ui/design-system'

type DarkCategory = 'drogues' | 'objets' | 'armes' | 'kit_disqueuses'

type DarkChatCard = {
  id: string
  name: string
  category: DarkCategory
  imageData: string
  createdAt: string
}

const STORAGE_KEY = 'pyke.darkchat.cards.v1'

const CATEGORY_LABELS: Record<DarkCategory, string> = {
  drogues: 'Drogues',
  objets: 'Objets',
  armes: 'Armes',
  kit_disqueuses: 'Kit&Disqueuses',
}

function readCards(): DarkChatCard[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DarkChatCard[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCards(cards: DarkChatCard[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

export default function DarkChatClient() {
  const [cards, setCards] = useState<DarkChatCard[]>(() => readCards())
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DarkCategory>('drogues')
  const [imageData, setImageData] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | DarkCategory>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cards.filter((card) => {
      if (filter !== 'all' && card.category !== filter) return false
      if (!q) return true
      return `${card.name} ${CATEGORY_LABELS[card.category]}`.toLowerCase().includes(q)
    })
  }, [cards, filter, query])

  async function onPickFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choisis une image valide.')
      return
    }
    const data = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(data)))
    setImageData(`data:${file.type};base64,${base64}`)
  }

  async function onPasteImage(event: ClipboardEvent<HTMLDivElement>) {
    const imageItem = [...event.clipboardData.items].find((item) => item.type.startsWith('image/'))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    event.preventDefault()
    await onPickFile(file)
    toast.success('Image collée depuis le presse-papiers.')
  }

  async function copyName(value: string, id: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      toast.success('Nom darkchat copié.')
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1200)
    } catch {
      toast.error('Impossible de copier le nom.')
    }
  }

  function createCard() {
    if (!name.trim()) return toast.error('Le nom darkchat est obligatoire.')
    if (!imageData) return toast.error('Ajoute la photo de la carte darkchat.')
    const next: DarkChatCard = {
      id: crypto.randomUUID(),
      name: name.trim(),
      category,
      imageData,
      createdAt: new Date().toISOString(),
    }
    const updated = [next, ...cards]
    setCards(updated)
    saveCards(updated)
    setName('')
    setImageData('')
    toast.success('Carte darkchat ajoutée.')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Annuaire · Dark Chat" subtitle="Stocke les noms darkchat et les cartes associées par catégorie." />

      <div className="flex flex-wrap gap-2">
        <Link href="/annuaire/contact"><SecondaryButton>Contacts</SecondaryButton></Link>
        <Link href="/annuaire/darkchat"><PrimaryButton>Dark Chat</PrimaryButton></Link>
      </div>

      <Panel>
        <div onPaste={(event) => void onPasteImage(event)} tabIndex={0}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom darkchat" className="h-11" />
          <select value={category} onChange={(e) => setCategory(e.target.value as DarkCategory)} className="h-11 rounded-xl border border-white/15 bg-white/[0.05] px-3 text-sm text-white outline-none">
            {(Object.keys(CATEGORY_LABELS) as DarkCategory[]).map((key) => <option key={key} value={key} className="bg-[#0b1228]">{CATEGORY_LABELS[key]}</option>)}
          </select>
          <Input type="file" accept="image/*" onChange={(e) => void onPickFile(e.target.files?.[0] || null)} className="h-11 pt-2" />
          <PrimaryButton onClick={createCard} className="h-11">Ajouter</PrimaryButton>
        </div>
        {imageData ? (
          <div className="mt-3 h-24 w-40 overflow-hidden rounded-xl border border-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageData} alt="Preview carte darkchat" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <p className="mt-2 text-xs text-white/60">Tu peux aussi coller une image avec Ctrl+V dans ce bloc.</p>
        </div>
      </Panel>

      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un nom darkchat" className="w-full max-w-sm" />
          <div className="ml-auto flex flex-wrap gap-2">
            <TabPill active={filter === 'all'} onClick={() => setFilter('all')}>Tous</TabPill>
            {(Object.keys(CATEGORY_LABELS) as DarkCategory[]).map((key) => <TabPill key={key} active={filter === key} onClick={() => setFilter(key)}>{CATEGORY_LABELS[key]}</TabPill>)}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((card) => (
            <div key={card.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold">{card.name}</p>
                <button type="button" onClick={() => void copyName(card.name, card.id)} className="rounded-lg border border-white/15 bg-white/[0.04] p-1.5 text-white/80">
                  {copiedId === card.id ? <ClipboardCheck className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                </button>
              </div>
              <p className="mb-2 text-xs text-white/70">{CATEGORY_LABELS[card.category]}</p>
              <div className="h-36 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                {card.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.imageData} alt={`Carte ${card.name}`} className="h-full w-full object-cover" />
                ) : <div className="grid h-full place-items-center text-white/40"><ImageIcon className="h-5 w-5" /></div>}
              </div>
            </div>
          ))}
          {filtered.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">Aucune carte darkchat.</div> : null}
        </div>
      </Panel>
    </div>
  )
}
