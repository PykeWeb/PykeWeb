'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Input } from '@/components/ui/Input'
import { createActivity, listActivities, updateActivitySettings, type ActivityListResponse } from '@/lib/activitiesApi'
import { ACTIVITY_OPTIONS, type ActivityType } from '@/lib/types/activities'
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

function ItemQuickPicker({
  title,
  items,
  selectedId,
  onSelect,
  disabled,
}: {
  title: string
  items: CatalogItem[]
  selectedId: string
  onSelect: (itemId: string) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return items.slice(0, 8)
    return items.filter((item) => item.name.toLowerCase().includes(search)).slice(0, 8)
  }, [items, query])

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-sm font-semibold">{title}</p>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher..." />
      <div className="flex flex-wrap gap-2">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            disabled={disabled}
            className={`rounded-xl border px-3 py-1.5 text-xs transition ${selectedId === item.id ? 'border-cyan-300/45 bg-cyan-500/20 text-cyan-50' : 'border-white/12 bg-white/[0.06] text-white/90 hover:bg-white/[0.12]'} disabled:opacity-50`}
          >
            {item.name} • {Math.max(0, Number(item.buy_price) || 0).toLocaleString('fr-FR')} $
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ActivitesPage() {
  const [memberName, setMemberName] = useState('')
  const [activityType, setActivityType] = useState<ActivityType>('Cambriolage')
  const [objectId, setObjectId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [percent, setPercent] = useState(2)
  const [proofImageData, setProofImageData] = useState('')
  const [data, setData] = useState<ActivityListResponse | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [saving, setSaving] = useState(false)
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

  const selectedMemberSummary = useMemo(() => {
    const normalizedName = memberName.trim().toLowerCase()
    if (!normalizedName || !data) return null
    return data.summaries.find((entry) => entry.member_name.toLowerCase() === normalizedName) ?? null
  }, [data, memberName])

  const estimatedThisLine = useMemo(() => {
    const objectPrice = Math.max(0, Number(selectedObject?.buy_price) || 0)
    const safeQty = Math.max(0, Math.floor(Number(quantity) || 0))
    const safePercent = Math.max(0, Number(percent) || 0)
    return objectPrice * safeQty * (safePercent / 100)
  }, [selectedObject?.buy_price, quantity, percent])

  async function onSubmit() {
    if (!proofImageData) {
      setError('Ajoute une preuve image (jpeg ou png).')
      return
    }

    try {
      setSaving(true)
      setError(null)
      await createActivity({
        member_name: memberName,
        activity_type: activityType,
        object_item_id: objectId,
        equipment_item_id: activityType === 'Boite au lettre' ? null : equipmentId,
        quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
        percent_per_object: Math.max(0.01, Number(percent) || 0.01),
        proof_image_data: proofImageData,
      })
      setOk('Activité enregistrée ✅')
      setQuantity(1)
      setProofImageData('')
      await refresh()
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Impossible d\'enregistrer.')
    } finally {
      setSaving(false)
    }
  }

  async function onPickFile(file: File | null) {
    if (!file) return
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      setError('Format non supporté. Utilise jpeg ou png.')
      return
    }
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

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <ItemQuickPicker title="Objets du groupe (clique pour sélectionner)" items={objectItems} selectedId={objectId} onSelect={setObjectId} disabled={saving} />
          {activityType !== 'Boite au lettre' ? (
            <ItemQuickPicker title="Équipements du groupe" items={equipmentItems} selectedId={equipmentId} onSelect={setEquipmentId} disabled={saving} />
          ) : (
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">Boite au lettre: pas besoin d’équipement.</div>
          )}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Quantité objet</span>
            <Input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">% pour cet objet</span>
            <Input type="number" min={0.01} step={0.01} value={percent} onChange={(event) => setPercent(Math.max(0.01, Number(event.target.value) || 0.01))} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Preuve (jpeg/png)</span>
            <Input type="file" accept="image/png,image/jpeg" onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)} className="pt-2" />
          </label>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
          <p>Objet choisi: <span className="font-semibold">{selectedObject?.name || '—'}</span></p>
          <p>Équipement choisi: <span className="font-semibold">{activityType === 'Boite au lettre' ? 'Aucun requis' : selectedEquipment?.name || '—'}</span></p>
          <p>Salaire estimé de cette ligne: <span className="font-semibold">{estimatedThisLine.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</span></p>
        </div>

        {proofImageData ? <Image src={proofImageData} alt="Preuve" width={320} height={192} unoptimized className="mt-4 max-h-48 w-auto rounded-xl border border-white/10" /> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void onSubmit()} disabled={saving}>{saving ? 'Enregistrement…' : 'Valider activité'}</Button>
          {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <h2 className="text-xl font-semibold">Semaine en cours (Lundi 00h → Dimanche 00h)</h2>
        <p className="mt-1 text-sm text-white/70">Le salaire est calculé automatiquement avec le prix objet du groupe × quantité × % choisi.</p>
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
          <p>Total objets ({memberName || 'membre'}): <span className="font-semibold">{selectedMemberSummary?.total_objects ?? 0}</span></p>
          <p>Salaire cumulé ({memberName || 'membre'}): <span className="font-semibold">{Math.max(0, Number(selectedMemberSummary?.total_salary) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</span></p>
          <p className="mt-1 text-white/65">Le champ « Salaire de base hebdo » a été supprimé: le calcul se fait directement par objet, comme demandé.</p>
        </div>
      </section>

      {!isMember ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <h2 className="text-xl font-semibold">Gestion Chef</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-white/70">% par défaut</span>
              <Input type="number" min={0.01} step={0.01} value={data?.settings.default_percent_per_object ?? 2} onChange={() => undefined} readOnly />
            </label>
            <Button variant="secondary" onClick={() => void updateActivitySettings({ default_percent_per_object: 2 }).then(refresh)}>Mettre % test à 2</Button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-white/[0.04] text-white/70">
                <tr>
                  <th className="px-3 py-2 text-left">Membre</th>
                  <th className="px-3 py-2 text-left">Activité</th>
                  <th className="px-3 py-2 text-left">Objet</th>
                  <th className="px-3 py-2 text-left">Prix</th>
                  <th className="px-3 py-2 text-left">Qté</th>
                  <th className="px-3 py-2 text-left">%</th>
                  <th className="px-3 py-2 text-left">Salaire</th>
                  <th className="px-3 py-2 text-left">Preuve</th>
                </tr>
              </thead>
              <tbody>
                {(data?.entries ?? []).map((entry) => (
                  <tr key={entry.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{entry.member_name}</td>
                    <td className="px-3 py-2">{entry.activity_type}</td>
                    <td className="px-3 py-2">{entry.object_name}</td>
                    <td className="px-3 py-2">{Math.max(0, Number(entry.object_unit_price) || 0)} $</td>
                    <td className="px-3 py-2">{entry.quantity}</td>
                    <td className="px-3 py-2">{Math.max(0, Number(entry.percent_per_object) || 0)}%</td>
                    <td className="px-3 py-2">{Math.max(0, Number(entry.salary_amount) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</td>
                    <td className="px-3 py-2"><Image src={entry.proof_image_data} alt="preuve" width={40} height={40} unoptimized className="h-10 w-10 rounded object-cover" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
