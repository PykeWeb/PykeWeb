'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Input } from '@/components/ui/Input'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { createActivity, listActivities, updateActivitySettings, type ActivityListResponse } from '@/lib/activitiesApi'
import {
  ACTIVITY_OPTIONS,
  type ActivityEntry,
  type ActivityEquipmentLineInput,
  type ActivityObjectLineInput,
  type ActivityType,
} from '@/lib/types/activities'
import { getTenantSession, isMemberTenantSession } from '@/lib/tenantSession'
import { listCatalogItems } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { copy } from '@/lib/copy'

type SelectedLine = { itemId: string; quantity: number }
type SelectionStep = 'equipment' | 'objects'

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

function groupEntriesByMember(entries: ActivityEntry[]) {
  const map = new Map<string, { totalSalary: number; totalObjects: number; entries: ActivityEntry[] }>()
  for (const entry of entries) {
    const key = entry.member_name.trim() || 'Inconnu'
    const current = map.get(key) ?? { totalSalary: 0, totalObjects: 0, entries: [] }
    current.totalSalary += Math.max(0, Number(entry.salary_amount) || 0)
    current.totalObjects += Math.max(0, Number(entry.quantity) || 0)
    current.entries.push(entry)
    map.set(key, current)
  }
  return [...map.entries()].map(([memberName, value]) => ({ memberName, ...value })).sort((a, b) => b.totalSalary - a.totalSalary)
}

export default function ActivitesPage() {
  const [memberName, setMemberName] = useState('')
  const [activityType, setActivityType] = useState<ActivityType>('Cambriolage')
  const [step, setStep] = useState<SelectionStep>('equipment')
  const [selectedEquipmentLines, setSelectedEquipmentLines] = useState<SelectedLine[]>([])
  const [selectedObjectLines, setSelectedObjectLines] = useState<SelectedLine[]>([])
  const [percentDraft, setPercentDraft] = useState(2)
  const [proofImageData, setProofImageData] = useState('')
  const [data, setData] = useState<ActivityListResponse | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [saving, setSaving] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [isChef, setIsChef] = useState(false)

  useEffect(() => {
    const session = getTenantSession()
    setIsMember(isMemberTenantSession(session))
    setIsChef(Boolean(session?.isAdmin || session?.role === 'chef'))
    void refresh()
    void listCatalogItems().then(setCatalogItems).catch(() => setCatalogItems([]))
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
      setPercentDraft(Math.max(0.01, Number(response.settings.default_percent_per_object) || 2))
      setError(null)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.')
    }
  }

  const objectItems = useMemo(() => catalogItems.filter((item) => item.category === 'objects' && item.is_active), [catalogItems])
  const equipmentItems = useMemo(() => catalogItems.filter((item) => item.category === 'equipment' && item.is_active), [catalogItems])

  const effectivePercent = useMemo(() => {
    if (isMember) return Math.max(0.01, Number(data?.settings.default_percent_per_object) || 2)
    return Math.max(0.01, Number(percentDraft) || 0.01)
  }, [isMember, data?.settings.default_percent_per_object, percentDraft])

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
        const item = equipmentItems.find((entry) => entry.id === line.itemId)
        if (!item) return null
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
        return { line, item, qty }
      })
      .filter((entry): entry is { line: SelectedLine; item: CatalogItem; qty: number } => Boolean(entry))
  }, [selectedEquipmentLines, equipmentItems])

  const estimatedThisSubmission = useMemo(() => selectedObjectRows.reduce((sum, row) => sum + row.salary, 0), [selectedObjectRows])
  const selectedMemberSummary = useMemo(() => {
    const normalizedName = memberName.trim().toLowerCase()
    if (!normalizedName || !data) return null
    return data.summaries.find((entry) => entry.member_name.toLowerCase() === normalizedName) ?? null
  }, [data, memberName])
  const groupedForChef = useMemo(() => groupEntriesByMember(data?.entries ?? []), [data?.entries])

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
    if (!proofImageData) return setError('Ajoute une preuve image (jpeg ou png).')
    if (selectedObjectRows.length === 0) return setError('Ajoute au moins un objet.')
    if (activityType !== 'Boite au lettre' && selectedEquipmentRows.length === 0) return setError('Ajoute au moins un équipement.')

    const objectLines: ActivityObjectLineInput[] = selectedObjectRows.map((row) => ({ object_item_id: row.item.id, quantity: row.qty }))
    const equipmentLines: ActivityEquipmentLineInput[] = selectedEquipmentRows.map((row) => ({ equipment_item_id: row.item.id, quantity: row.qty }))

    try {
      setSaving(true)
      setError(null)
      await createActivity({
        member_name: memberName,
        activity_type: activityType,
        object_lines: objectLines,
        equipment_lines: activityType === 'Boite au lettre' ? [] : equipmentLines,
        percent_per_object: effectivePercent,
        proof_image_data: proofImageData,
      })
      setOk(`Activité enregistrée ✅ (${objectLines.length} objet${objectLines.length > 1 ? 's' : ''})`)
      setSelectedObjectLines([])
      setSelectedEquipmentLines([])
      setProofImageData('')
      setStep(activityType === 'Boite au lettre' ? 'objects' : 'equipment')
      await refresh()
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Impossible d\'enregistrer.')
    } finally {
      setSaving(false)
    }
  }

  async function saveDefaultPercent() {
    try {
      setSavingSettings(true)
      await updateActivitySettings({ default_percent_per_object: Math.max(0.01, Number(percentDraft) || 0.01) })
      await refresh()
    } catch (settingsError: unknown) {
      setError(settingsError instanceof Error ? settingsError.message : 'Impossible de modifier le % par défaut.')
    } finally {
      setSavingSettings(false)
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
  const leftItems = step === 'equipment' ? equipmentItems : objectItems

  return (
    <div className="space-y-6" onPaste={(event) => void onPaste(event)}>
      <PageHeader title={copy.activities.title} subtitle={copy.activities.subtitle} />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">Déclaration activité</h2>
          <div className="ml-auto flex flex-wrap items-stretch justify-end gap-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <p>Équipements sélectionnés: <span className="font-semibold">{selectedEquipmentRows.length}</span></p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <p>Objets sélectionnés: <span className="font-semibold">{selectedObjectRows.length}</span></p>
            </div>
            <div className="min-w-[130px] rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-right">
              <p className="text-cyan-100">Salaire :</p>
              <p className="font-semibold text-cyan-50">{estimatedThisSubmission.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Nom du joueur</span>
            <Input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="Ex: Zoro" />
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

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {isChef ? (
            <label className="space-y-1 text-sm">
              <span className="text-white/70">% appliqué aux objets</span>
              <Input type="number" min={0.01} step={0.01} value={percentDraft} onChange={(event) => setPercentDraft(Math.max(0.01, Number(event.target.value) || 0.01))} />
            </label>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Preuve (jpeg/png) • Upload ou coller une capture (Ctrl+V)</span>
            <Input type="file" accept="image/png,image/jpeg" onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)} className="pt-2" />
          </label>
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

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <h2 className="text-xl font-semibold">Semaine en cours (Lundi 00h → Dimanche 00h)</h2>
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
          <p>Total objets ({memberName || 'membre'}): <span className="font-semibold">{selectedMemberSummary?.total_objects ?? 0}</span></p>
          <p>Salaire cumulé ({memberName || 'membre'}): <span className="font-semibold">{Math.max(0, Number(selectedMemberSummary?.total_salary) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</span></p>
        </div>
      </section>

      {isChef ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <h2 className="text-xl font-semibold">Gestion Chef</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-white/70">% par défaut</span>
              <Input type="number" min={0.01} step={0.01} value={percentDraft} onChange={(event) => setPercentDraft(Math.max(0.01, Number(event.target.value) || 0.01))} />
            </label>
            <Button variant="secondary" onClick={() => void saveDefaultPercent()} disabled={savingSettings}>{savingSettings ? 'Enregistrement…' : 'Enregistrer le % par défaut'}</Button>
          </div>

          <div className="mt-4 space-y-4">
            {groupedForChef.map((member) => (
              <div key={member.memberName} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{member.memberName}</p>
                  <p className="text-xs text-white/70">Objets: {member.totalObjects} • Salaire: {member.totalSalary.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</p>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[940px] text-sm">
                    <thead className="bg-white/[0.04] text-white/70">
                      <tr>
                        <th className="px-3 py-2 text-left">Activité</th>
                        <th className="px-3 py-2 text-left">Objet</th>
                        <th className="px-3 py-2 text-left">Qté obj</th>
                        <th className="px-3 py-2 text-left">Équipements</th>
                        <th className="px-3 py-2 text-left">Qté eqp</th>
                        <th className="px-3 py-2 text-left">%</th>
                        <th className="px-3 py-2 text-left">Salaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {member.entries.map((entry) => (
                        <tr key={entry.id} className="border-t border-white/10">
                          <td className="px-3 py-2">{entry.activity_type}</td>
                          <td className="px-3 py-2">{entry.object_name}</td>
                          <td className="px-3 py-2">{entry.quantity}</td>
                          <td className="px-3 py-2">{entry.equipment_name || '—'}</td>
                          <td className="px-3 py-2">{Math.max(0, Number(entry.equipment_quantity) || 0)}</td>
                          <td className="px-3 py-2">{Math.max(0, Number(entry.percent_per_object) || 0)}%</td>
                          <td className="px-3 py-2">{Math.max(0, Number(entry.salary_amount) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
