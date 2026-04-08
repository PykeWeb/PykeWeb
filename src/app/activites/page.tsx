'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Button } from '@/components/ui/Button'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Input } from '@/components/ui/Input'
import { MemberSelect } from '@/components/ui/MemberSelect'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { createActivity, listActivities, type ActivityListResponse } from '@/lib/activitiesApi'
import {
  ACTIVITY_OPTIONS,
  type ActivityEquipmentLineInput,
  type ActivityObjectLineInput,
  type ActivityType,
} from '@/lib/types/activities'
import { listCatalogItemsUnified, resolveCatalogItemId } from '@/lib/itemsApi'
import { getTenantSession } from '@/lib/tenantSession'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { copy } from '@/lib/copy'
import { ActivitiesPageTabs } from '@/components/activities/ActivitiesPageTabs'
import { ActivitiesCategoryTabs } from '@/components/activities/ActivitiesCategoryTabs'
import { expandAccessPrefixes } from '@/lib/types/groupRoles'

type SelectedLine = { itemId: string; quantity: number }
type SelectionStep = 'equipment' | 'objects'

const ACTIVITY_EQUIPMENT_RULES: Partial<Record<ActivityType, string[]>> = {
  Cambriolage: ['kit de cambriolage'],
  Conteneur: ['disqueuse'],
  ATM: ['grosse perceuse'],
  Superette: ['grosse perceuse'],
}

const ACTIVITY_SPECIAL_OBJECT_NAMES = new Set([
  "bouteilles d'eau",
  'argent',
  'telephone de hack',
  'téléphone de hack',
  'disqueuse',
  'kit de cambu',
  'kit de cambriolage',
])

function normalizeLabel(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'))
    reader.readAsDataURL(file)
  })
}

function CatalogScrollableList({
  title,
  items,
  onSelect,
}: {
  title: string
  items: CatalogItem[]
  onSelect: (item: CatalogItem) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) => item.name.toLowerCase().includes(normalized))
  }, [items, query])

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-sm font-semibold">{title}</p>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher..." />
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-2 text-left transition hover:bg-white/[0.09]"
          >
            {item.image_url ? (
              <Image src={item.image_url} alt={item.name} width={44} height={44} className="h-11 w-11 rounded-lg object-cover" unoptimized />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-xs text-white/55">IMG</div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight break-words">{item.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ActivitesPage() {
  const [memberName, setMemberName] = useState('')
  const [memberOptions, setMemberOptions] = useState<string[]>([])
  const [activityType, setActivityType] = useState<ActivityType>('Cambriolage')
  const [step, setStep] = useState<SelectionStep>('equipment')
  const [selectedEquipmentLines, setSelectedEquipmentLines] = useState<SelectedLine[]>([])
  const [selectedObjectLines, setSelectedObjectLines] = useState<SelectedLine[]>([])
  const [proofImageData, setProofImageData] = useState('')
  const [data, setData] = useState<ActivityListResponse | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [canSeeChefTab, setCanSeeChefTab] = useState(false)
  const memberSelectOptions = useMemo(() => {
    const current = memberName.trim()
    if (!current) return memberOptions
    return memberOptions.some((name) => name.toLowerCase() === current.toLowerCase()) ? memberOptions : [current, ...memberOptions]
  }, [memberName, memberOptions])

  useEffect(() => {
    const session = getTenantSession()
    const sessionMember = String(session?.memberName || '').trim()
    if (sessionMember) setMemberName(sessionMember)
    const allowed = expandAccessPrefixes(Array.isArray(session?.allowedPrefixes) ? session.allowedPrefixes : [])
    setCanSeeChefTab(Boolean(session?.isAdmin || allowed.includes('/') || allowed.includes('/activites/gestion-chef')))
    void refresh()
    void listCatalogItemsUnified().then(setCatalogItems).catch(() => setCatalogItems([]))
    void fetch('/api/group/members', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return []
        const payload = (await res.json()) as { members?: string[] }
        return Array.isArray(payload.members) ? payload.members : []
      })
      .then((rows) => setMemberOptions(rows))
      .catch(() => setMemberOptions([]))
  }, [])

  useEffect(() => {
    if (activityType === 'Boite au lettre') {
      setSelectedEquipmentLines([])
      setStep('objects')
    } else if (step === 'objects' && selectedEquipmentLines.length === 0) {
      setStep('equipment')
    }
  }, [activityType, step, selectedEquipmentLines.length])

  async function refresh() {
    try {
      const response = await listActivities()
      setData(response)
      setError(null)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.')
    }
  }

  const objectItems = useMemo(() => {
    return catalogItems.filter((item) => {
      if (!item.is_active) return false
      if (item.category === 'objects') return true
      const normalizedName = normalizeLabel(item.name)
      if (ACTIVITY_SPECIAL_OBJECT_NAMES.has(normalizedName)) return true
      if (item.category !== 'drugs') return false
      return normalizedName === 'pochon de coke' || normalizedName === 'pochon de meth'
    })
  }, [catalogItems])
  const equipmentItems = useMemo(() => catalogItems.filter((item) => item.category === 'equipment' && item.is_active), [catalogItems])

  const allowedEquipmentItems = useMemo(() => {
    const rules = ACTIVITY_EQUIPMENT_RULES[activityType]
    if (!rules || rules.length === 0) return equipmentItems
    return equipmentItems.filter((item) => {
      const name = item.name.toLowerCase()
      return rules.some((keyword) => name.includes(keyword))
    })
  }, [activityType, equipmentItems])

  useEffect(() => {
    const allowedIds = new Set(allowedEquipmentItems.map((item) => item.id))
    setSelectedEquipmentLines((prev) => prev.filter((line) => allowedIds.has(line.itemId)))
  }, [allowedEquipmentItems])

  const effectivePercent = useMemo(() => Math.max(0.01, Number(data?.settings.default_percent_per_object) || 2), [data?.settings.default_percent_per_object])

  const selectedObjectRows = useMemo(() => {
    return selectedObjectLines
      .map((line) => {
        const item = objectItems.find((entry) => entry.id === line.itemId)
        if (!item) return null
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
        const price = Math.max(0, Number(item.buy_price) || 0)
        return { line, item, qty, salary: price * qty * (effectivePercent / 100) }
      })
      .filter((entry): entry is { line: SelectedLine; item: CatalogItem; qty: number; salary: number } => Boolean(entry))
  }, [selectedObjectLines, objectItems, effectivePercent])

  const selectedEquipmentRows = useMemo(() => {
    return selectedEquipmentLines
      .map((line) => {
        const item = allowedEquipmentItems.find((entry) => entry.id === line.itemId)
        if (!item) return null
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
        return { line, item, qty }
      })
      .filter((entry): entry is { line: SelectedLine; item: CatalogItem; qty: number } => Boolean(entry))
  }, [selectedEquipmentLines, allowedEquipmentItems])

  const estimatedThisSubmission = useMemo(() => selectedObjectRows.reduce((sum, row) => sum + row.salary, 0), [selectedObjectRows])
  const activitiesBubbleStats = useMemo(() => {
    const entries = data?.entries ?? []
    const todayIso = new Date().toISOString().slice(0, 10)
    const today = entries.filter((entry) => String(entry.created_at).slice(0, 10) === todayIso).length
    return { today, week: entries.length }
  }, [data?.entries])


  function addLine(setter: Dispatch<SetStateAction<SelectedLine[]>>, itemId: string) {
    setter((prev) => {
      const index = prev.findIndex((line) => line.itemId === itemId)
      if (index < 0) return [...prev, { itemId, quantity: 1 }]
      return prev.map((line, i) => (i === index ? { ...line, quantity: Math.max(1, line.quantity + 1) } : line))
    })
  }

  function updateLineQty(setter: Dispatch<SetStateAction<SelectedLine[]>>, itemId: string, qty: number) {
    setter((prev) => prev.map((line) => (line.itemId === itemId ? { ...line, quantity: Math.max(1, qty) } : line)))
  }

  function removeLine(setter: Dispatch<SetStateAction<SelectedLine[]>>, itemId: string) {
    setter((prev) => prev.filter((line) => line.itemId !== itemId))
  }

  async function onSubmit() {
    if (selectedObjectRows.length === 0) return setError('Ajoute au moins un objet.')
    if (activityType !== 'Boite au lettre' && selectedEquipmentRows.length === 0) return setError('Ajoute au moins un équipement.')

    const objectLines: ActivityObjectLineInput[] = await Promise.all(
      selectedObjectRows.map(async (row) => ({ object_item_id: await resolveCatalogItemId(row.item.id), quantity: row.qty }))
    )
    const equipmentLines: ActivityEquipmentLineInput[] = await Promise.all(
      selectedEquipmentRows.map(async (row) => ({ equipment_item_id: await resolveCatalogItemId(row.item.id), quantity: row.qty }))
    )

    try {
      setSaving(true)
      setError(null)
      await createActivity({
        member_name: memberName,
        activity_type: activityType,
        object_lines: objectLines,
        equipment_lines: activityType === 'Boite au lettre' ? [] : equipmentLines,
        percent_per_object: Math.max(0.01, Number(data?.settings.default_percent_per_object) || 2),
        proof_image_data: proofImageData || '',
      })
      setOk(`Activité enregistrée ✅ (${objectLines.length} objet${objectLines.length > 1 ? 's' : ''})`)
      setSelectedObjectLines([])
      setSelectedEquipmentLines([])
      setProofImageData('')
      setStep(activityType === 'Boite au lettre' ? 'objects' : 'equipment')
      await refresh()
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Impossible d’enregistrer.')
    } finally {
      setSaving(false)
    }
  }



  async function onPickFile(file: File | null) {
    if (!file) return
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') return setError('Format non supporté. Utilise jpeg ou png.')
    const dataUrl = await fileToDataUrl(file)
    setProofImageData(dataUrl)
    setError(null)
  }

  async function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const imageItem = [...event.clipboardData.items].find((entry) => entry.type === 'image/png' || entry.type === 'image/jpeg')
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setProofImageData(dataUrl)
    setError(null)
  }

  const leftTitle = step === 'equipment' ? 'Équipements du groupe (molette pour défiler)' : 'Objets du groupe (molette pour défiler)'
  const leftItems = step === 'equipment' ? allowedEquipmentItems : objectItems

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-glow">
        <div className="space-y-3">
          <div>
            <ActivitiesCategoryTabs active="activites" activitiesStats={activitiesBubbleStats} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
            <ActivitiesPageTabs active="declaration" showChef={canSeeChefTab} />
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <div className="inline-flex h-9 items-center rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs font-semibold leading-none text-white/85 transition hover:bg-white/[0.12]">
                <p>Équipements sélectionnés: <span className="font-semibold">{selectedEquipmentRows.length}</span></p>
              </div>
              <div className="inline-flex h-9 items-center rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs font-semibold leading-none text-white/85 transition hover:bg-white/[0.12]">
                <p>Objets sélectionnés: <span className="font-semibold">{selectedObjectRows.length}</span></p>
              </div>
              <div className="inline-flex h-9 items-center rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 text-xs font-semibold leading-none text-cyan-100 transition hover:bg-cyan-500/22">
                <p>Salaire: {estimatedThisSubmission.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Membre</span>
            <MemberSelect value={memberName} onChange={setMemberName} options={memberSelectOptions} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Activité</span>
            <GlassSelect value={activityType} onChange={(value) => setActivityType(value as ActivityType)} options={ACTIVITY_OPTIONS.map((value) => ({ value, label: value }))} />
          </label>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2 lg:items-start">
          <CatalogScrollableList
            title={leftTitle}
            items={leftItems}
            onSelect={(item) => {
              if (step === 'equipment') addLine(setSelectedEquipmentLines, item.id)
              else addLine(setSelectedObjectLines, item.id)
            }}
          />

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{step === 'equipment' ? 'Équipements choisis' : 'Objets choisis'}</p>
              {activityType !== 'Boite au lettre' ? (
                <Button
                  variant="secondary"
                  onClick={() => setStep((prev) => (prev === 'equipment' ? 'objects' : 'equipment'))}
                  disabled={step === 'equipment' && selectedEquipmentRows.length === 0}
                >
                  {step === 'equipment' ? 'Valider équipements' : 'Modifier équipements'}
                </Button>
              ) : null}
            </div>

            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {(step === 'equipment' ? selectedEquipmentRows : selectedObjectRows).length === 0 ? (
                <p className="text-sm text-white/60">Aucune ligne sélectionnée.</p>
              ) : null}

              {step === 'equipment'
                ? selectedEquipmentRows.map((row) => (
                    <div key={row.item.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {row.item.image_url ? (
                          <Image src={row.item.image_url} alt={row.item.name} width={34} height={34} className="h-8 w-8 rounded object-cover" unoptimized />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded border border-white/10 bg-white/[0.05] text-[10px] text-white/55">IMG</div>
                        )}
                        <p className="text-sm font-medium leading-tight break-words">{row.item.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <QuantityStepper value={row.qty} onChange={(value) => updateLineQty(setSelectedEquipmentLines, row.item.id, value)} size="sm" fitContent />
                        <button type="button" onClick={() => removeLine(setSelectedEquipmentLines, row.item.id)} className="rounded-lg border border-rose-300/35 bg-rose-500/15 px-2 py-1 text-xs text-rose-100 hover:bg-rose-500/25">Retirer</button>
                      </div>
                    </div>
                  ))
                : selectedObjectRows.map((row) => (
                    <div key={row.item.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {row.item.image_url ? (
                          <Image src={row.item.image_url} alt={row.item.name} width={34} height={34} className="h-8 w-8 rounded object-cover" unoptimized />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded border border-white/10 bg-white/[0.05] text-[10px] text-white/55">IMG</div>
                        )}
                        <p className="text-sm font-medium leading-tight break-words">{row.item.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <QuantityStepper value={row.qty} onChange={(value) => updateLineQty(setSelectedObjectLines, row.item.id, value)} size="sm" fitContent />
                        <button type="button" onClick={() => removeLine(setSelectedObjectLines, row.item.id)} className="rounded-lg border border-rose-300/35 bg-rose-500/15 px-2 py-1 text-xs text-rose-100 hover:bg-rose-500/25">Retirer</button>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-1">
          <div
            className="cursor-text rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            tabIndex={0}
            onPaste={(event) => void onPaste(event)}
            onClick={(event) => event.currentTarget.focus()}
          >
            <p className="text-sm text-white/70">Preuve (jpeg/png) • Clique ici puis colle une capture (Ctrl+V), ou choisis un fichier.</p>
            <div className="mt-2">
              <Input type="file" accept="image/png,image/jpeg" onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)} className="pt-2" />
            </div>
          </div>
        </div>

        {proofImageData ? (
          <div className="relative mt-4 inline-block">
            <Image src={proofImageData} alt="Preuve" width={320} height={192} unoptimized className="max-h-48 w-auto rounded-xl border border-white/10" />
            <button
              type="button"
              onClick={() => setProofImageData('')}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-rose-300/35 bg-rose-500/80 text-xs font-bold text-white hover:bg-rose-500"
              aria-label="Supprimer la preuve"
              title="Supprimer la preuve"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void onSubmit()} disabled={saving}>{saving ? 'Enregistrement…' : 'Valider activité'}</Button>
          {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}
        </div>
      </section>


      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
