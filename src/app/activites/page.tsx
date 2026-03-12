'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Input } from '@/components/ui/Input'
import { createActivity, listActivities, updateActivitySettings, type ActivityListResponse } from '@/lib/activitiesApi'
import { ACTIVITY_OPTIONS, EQUIPMENT_OPTIONS, type ActivityType } from '@/lib/types/activities'
import { getTenantSession, isMemberTenantSession } from '@/lib/tenantSession'

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'))
    reader.readAsDataURL(file)
  })
}

export default function ActivitesPage() {
  const [memberName, setMemberName] = useState('')
  const [activityType, setActivityType] = useState<ActivityType>('Cambriolage')
  const [equipment, setEquipment] = useState('Pied de biche')
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [proofImageData, setProofImageData] = useState('')
  const [manualBaseSalary, setManualBaseSalary] = useState(0)
  const [data, setData] = useState<ActivityListResponse | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    const session = getTenantSession()
    setIsMember(isMemberTenantSession(session))
    void refresh()
  }, [])

  async function refresh() {
    try {
      const response = await listActivities()
      setData(response)
      setError(null)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.')
    }
  }

  const filteredSummary = useMemo(() => {
    if (!data) return null
    const target = memberName.trim().toLowerCase()
    if (!target) return null
    return data.summaries.find((entry) => entry.member_name.toLowerCase() === target) ?? null
  }, [data, memberName])

  const computedSalary = useMemo(() => {
    if (!filteredSummary) return 0
    const base = manualBaseSalary > 0 ? manualBaseSalary : data?.settings.weekly_base_salary || 0
    return base * (filteredSummary.gain_percent / 100)
  }, [filteredSummary, manualBaseSalary, data?.settings.weekly_base_salary])

  async function onSubmit() {
    const equipmentValue = activityType === 'Boite au lettre' ? null : equipment
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
        equipment: equipmentValue,
        item_name: itemName,
        quantity,
        proof_image_data: proofImageData,
      })
      setOk('Activité enregistrée ✅')
      setItemName('')
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
      <PageHeader title="Catégorie Activités" subtitle="Déclare tes activités avec preuve obligatoire pour calculer le salaire hebdomadaire." />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <h2 className="text-xl font-semibold">Nouvelle activité</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Nom du joueur</span>
            <Input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="Ex: Zoro" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Activité</span>
            <GlassSelect value={activityType} onChange={(value) => setActivityType(value as ActivityType)} options={ACTIVITY_OPTIONS.map((value) => ({ value, label: value }))} />
          </label>
          {activityType !== 'Boite au lettre' ? (
            <label className="space-y-1 text-sm">
              <span className="text-white/70">Équipement</span>
              <GlassSelect value={equipment} onChange={setEquipment} options={EQUIPMENT_OPTIONS.map((value) => ({ value, label: value }))} />
            </label>
          ) : (
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">Boite au lettre: aucun équipement requis.</div>
          )}
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Objet récupéré</span>
            <Input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="Ex: Montre en or" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Quantité</span>
            <Input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Preuve (jpeg/png)</span>
            <Input type="file" accept="image/png,image/jpeg" onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)} className="pt-2" />
          </label>
        </div>
        {proofImageData ? <Image src={proofImageData} alt="Preuve" width={320} height={192} unoptimized className="mt-4 max-h-48 w-auto rounded-xl border border-white/10" /> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void onSubmit()} disabled={saving}>{saving ? 'Enregistrement…' : 'Valider l\'activité'}</Button>
          {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <h2 className="text-xl font-semibold">Salaire semaine (Lundi 00h → Dimanche 00h)</h2>
        <p className="mt-1 text-sm text-white/70">Chaque objet récupéré rapporte {data?.settings.percent_per_object ?? 2}%.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Salaire de base hebdo (optionnel)</span>
            <Input type="number" min={0} value={manualBaseSalary} onChange={(event) => setManualBaseSalary(Math.max(0, Number(event.target.value) || 0))} />
          </label>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
            <p>Objets récupérés: <span className="font-semibold">{filteredSummary?.total_objects ?? 0}</span></p>
            <p>Gain total: <span className="font-semibold">{filteredSummary?.gain_percent ?? 0}%</span></p>
            <p>Salaire estimé: <span className="font-semibold">{computedSalary.toLocaleString('fr-FR')} $</span></p>
          </div>
        </div>
      </section>

      {!isMember ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
          <h2 className="text-xl font-semibold">Gestion Chef</h2>
          <p className="mt-1 text-sm text-white/70">Tu peux voir qui a fait quoi et gérer le pourcentage par objet.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-white/70">% par objet</span>
              <Input type="number" min={0} value={data?.settings.percent_per_object ?? 2} onChange={() => undefined} readOnly />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-white/70">Salaire de base hebdo</span>
              <Input type="number" min={0} value={data?.settings.weekly_base_salary ?? 0} onChange={() => undefined} readOnly />
            </label>
            <div className="flex items-end">
              <Button variant="secondary" onClick={() => void updateActivitySettings({ percent_per_object: 2, weekly_base_salary: data?.settings.weekly_base_salary ?? 0 }).then(refresh)}>
                Mettre % test à 2
              </Button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-white/[0.04] text-white/70">
                <tr>
                  <th className="px-3 py-2 text-left">Membre</th>
                  <th className="px-3 py-2 text-left">Activité</th>
                  <th className="px-3 py-2 text-left">Équipement</th>
                  <th className="px-3 py-2 text-left">Objet</th>
                  <th className="px-3 py-2 text-left">Qté</th>
                  <th className="px-3 py-2 text-left">Preuve</th>
                </tr>
              </thead>
              <tbody>
                {(data?.entries ?? []).map((entry) => (
                  <tr key={entry.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{entry.member_name}</td>
                    <td className="px-3 py-2">{entry.activity_type}</td>
                    <td className="px-3 py-2">{entry.equipment || '—'}</td>
                    <td className="px-3 py-2">{entry.item_name}</td>
                    <td className="px-3 py-2">{entry.quantity}</td>
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
