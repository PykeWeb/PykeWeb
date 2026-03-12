'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Input } from '@/components/ui/Input'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { createActivity, listActivities, updateActivitySettings, type ActivityListResponse } from '@/lib/activitiesApi'
import { ACTIVITY_OPTIONS, type ActivityType, type ActivityEntry } from '@/lib/types/activities'
import { getTenantSession, isMemberTenantSession } from '@/lib/tenantSession'
import { listCatalogItems } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { copy } from '@/lib/copy'

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'))
    reader.readAsDataURL(file)
  })
}

function ItemListPicker({
  title,
  items,
  selectedId,
  selectedQty,
  onSelect,
  onQtyChange,
  disabled,
}: {
  title: string
  items: CatalogItem[]
  selectedId: string
  selectedQty: number
  onSelect: (itemId: string) => void
  onQtyChange: (qty: number) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items.slice(0, 12)
    return items.filter((item) => item.name.toLowerCase().includes(normalized)).slice(0, 12)
  }, [items, query])

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-sm font-semibold">{title}</p>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans la liste..." />
      <div className="space-y-2">
        {filteredItems.map((item) => {
          const active = item.id === selectedId
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-xl border p-2 ${active ? 'border-cyan-300/45 bg-cyan-500/10' : 'border-white/10 bg-white/[0.04]'}`}
            >
              <button type="button" onClick={() => onSelect(item.id)} disabled={disabled} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} width={44} height={44} className="h-11 w-11 rounded-lg object-cover" unoptimized />
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-xs text-white/60">IMG</div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-white/60">{Math.max(0, Number(item.buy_price) || 0).toLocaleString('fr-FR')} $</p>
                </div>
              </button>
              {active ? (
                <QuantityStepper value={selectedQty} onChange={(value) => onQtyChange(Math.max(1, value))} size="sm" fitContent />
              ) : null}
            </div>
          )
        })}
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
  return [...map.entries()]
    .map(([memberName, value]) => ({ memberName, ...value }))
    .sort((a, b) => b.totalSalary - a.totalSalary)
}

export default function ActivitesPage() {
  const [memberName, setMemberName] = useState('')
  const [activityType, setActivityType] = useState<ActivityType>('Cambriolage')
  const [objectId, setObjectId] = useState('')
  const [objectQty, setObjectQty] = useState(1)
  const [equipmentId, setEquipmentId] = useState('')
  const [equipmentQty, setEquipmentQty] = useState(1)
  const [percent, setPercent] = useState(2)
  const [proofImageData, setProofImageData] = useState('')
  const [data, setData] = useState<ActivityListResponse | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [saving, setSaving] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    const session = getTenantSession()
    setIsMember(isMemberTenantSession(session))
    void refresh()
    void listCatalogItems().then(setCatalogItems).catch(() => setCatalogItems([]))
  }, [])

  async function refresh() {
    try {
      const response = await listActivities()
      setData(response)
      setPercent(Math.max(0.01, Number(response.settings.default_percent_per_object) || 2))
      setError(null)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.')
    }
  }

  const objectItems = useMemo(() => catalogItems.filter((item) => item.category === 'objects' && item.is_active), [catalogItems])
  const equipmentItems = useMemo(() => catalogItems.filter((item) => item.category === 'equipment' && item.is_active), [catalogItems])

  const selectedObject = useMemo(() => objectItems.find((item) => item.id === objectId) ?? null, [objectItems, objectId])
  const selectedEquipment = useMemo(() => equipmentItems.find((item) => item.id === equipmentId) ?? null, [equipmentItems, equipmentId])

  const effectivePercent = useMemo(() => {
    if (isMember) return Math.max(0.01, Number(data?.settings.default_percent_per_object) || 2)
    return Math.max(0.01, Number(percent) || 0.01)
  }, [isMember, data?.settings.default_percent_per_object, percent])

  const selectedMemberSummary = useMemo(() => {
    const normalizedName = memberName.trim().toLowerCase()
    if (!normalizedName || !data) return null
    return data.summaries.find((entry) => entry.member_name.toLowerCase() === normalizedName) ?? null
  }, [data, memberName])

  const estimatedThisLine = useMemo(() => {
    const objectPrice = Math.max(0, Number(selectedObject?.buy_price) || 0)
    const safeQty = Math.max(0, Math.floor(Number(objectQty) || 0))
    return objectPrice * safeQty * (effectivePercent / 100)
  }, [selectedObject?.buy_price, objectQty, effectivePercent])

  const groupedForChef = useMemo(() => groupEntriesByMember(data?.entries ?? []), [data?.entries])

  async function onSubmit() {
    if (!proofImageData) return setError('Ajoute une preuve image (jpeg ou png).')

    try {
      setSaving(true)
      setError(null)
      await createActivity({
        member_name: memberName,
        activity_type: activityType,
        object_item_id: objectId,
        quantity: Math.max(1, Math.floor(Number(objectQty) || 1)),
        equipment_item_id: activityType === 'Boite au lettre' ? null : equipmentId,
        equipment_quantity: activityType === 'Boite au lettre' ? 0 : Math.max(1, Math.floor(Number(equipmentQty) || 1)),
        percent_per_object: effectivePercent,
        proof_image_data: proofImageData,
      })
      setOk('Activité enregistrée ✅')
      setObjectQty(1)
      setEquipmentQty(1)
      setProofImageData('')
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
      await updateActivitySettings({ default_percent_per_object: Math.max(0.01, Number(percent) || 0.01) })
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
    const item = [...event.clipboardData.items].find((entry) => entry.type === 'image/png' || entry.type === 'image/jpeg')
    if (!item) return
    const file = item.getAsFile()
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setProofImageData(dataUrl)
    setError(null)
  }

  return (
    <div className="space-y-6" onPaste={(event) => void onPaste(event)}>
      <PageHeader title={copy.activities.title} subtitle={copy.activities.subtitle} />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <h2 className="text-xl font-semibold">Déclaration activité</h2>
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

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <ItemListPicker
            title="Objets du groupe"
            items={objectItems}
            selectedId={objectId}
            selectedQty={objectQty}
            onSelect={setObjectId}
            onQtyChange={setObjectQty}
            disabled={saving}
          />
          {activityType !== 'Boite au lettre' ? (
            <ItemListPicker
              title="Équipements du groupe"
              items={equipmentItems}
              selectedId={equipmentId}
              selectedQty={equipmentQty}
              onSelect={setEquipmentId}
              onQtyChange={setEquipmentQty}
              disabled={saving}
            />
          ) : (
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">Boite au lettre: pas besoin d’équipement.</div>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-white/70">% appliqué à l’objet</span>
            <Input type="number" min={0.01} step={0.01} value={effectivePercent} onChange={(event) => setPercent(Math.max(0.01, Number(event.target.value) || 0.01))} readOnly={isMember} />
            {isMember ? <p className="text-xs text-white/55">Seul le chef peut modifier le pourcentage.</p> : null}
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Preuve (jpeg/png)</span>
            <Input type="file" accept="image/png,image/jpeg" onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)} className="pt-2" />
          </label>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
          <p>Objet: <span className="font-semibold">{selectedObject?.name || '—'}</span> • Qté: <span className="font-semibold">{objectQty}</span></p>
          <p>Équipement: <span className="font-semibold">{activityType === 'Boite au lettre' ? 'Aucun requis' : selectedEquipment?.name || '—'}</span>{activityType === 'Boite au lettre' ? '' : ` • Qté: ${equipmentQty}`}</p>
          <p>Salaire estimé: <span className="font-semibold">{estimatedThisLine.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</span></p>
        </div>

        {proofImageData ? <Image src={proofImageData} alt="Preuve" width={320} height={192} unoptimized className="mt-4 max-h-48 w-auto rounded-xl border border-white/10" /> : null}
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

      {!isMember ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <h2 className="text-xl font-semibold">Gestion Chef</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-white/70">% par défaut</span>
              <Input type="number" min={0.01} step={0.01} value={percent} onChange={(event) => setPercent(Math.max(0.01, Number(event.target.value) || 0.01))} />
            </label>
            <Button variant="secondary" onClick={() => void saveDefaultPercent()} disabled={savingSettings}>{savingSettings ? 'Enregistrement…' : 'Enregistrer le % par défaut'}</Button>
            <Button variant="ghost" onClick={() => void updateActivitySettings({ default_percent_per_object: 2 }).then(refresh)}>Mettre % test à 2</Button>
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
                        <th className="px-3 py-2 text-left">Équipement</th>
                        <th className="px-3 py-2 text-left">Qté eqp</th>
                        <th className="px-3 py-2 text-left">%</th>
                        <th className="px-3 py-2 text-left">Salaire</th>
                        <th className="px-3 py-2 text-left">Preuve</th>
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
                          <td className="px-3 py-2"><Image src={entry.proof_image_data} alt="preuve" width={40} height={40} className="h-10 w-10 rounded object-cover" unoptimized /></td>
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
