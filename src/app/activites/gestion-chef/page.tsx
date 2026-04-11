'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { listActivities, resetActivitiesCurrentWeek, updateActivitySettings, type ActivityListResponse } from '@/lib/activitiesApi'
import type { ActivityEntry } from '@/lib/types/activities'
import { copy } from '@/lib/copy'
import { getTenantSession } from '@/lib/tenantSession'
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { ActivitiesPageTabs } from '@/components/activities/ActivitiesPageTabs'
import { ActivitiesCategoryTabs } from '@/components/activities/ActivitiesCategoryTabs'
import { expandAccessPrefixes } from '@/lib/types/groupRoles'

type GroupedMember = {
  memberName: string
  totalSalary: number
  totalObjects: number
  entries: ActivityEntry[]
}

type MemberActivitySummary = {
  activityType: string
  runCount: number
  totalSalary: number
  totalObjects: number
  objectLines: Array<{ name: string; qty: number }>
  equipmentLines: Array<{ name: string; qty: number }>
  latestProof: string
  latestAt: string
}

function groupEntriesByMember(entries: ActivityEntry[]): GroupedMember[] {
  const map = new Map<string, GroupedMember>()
  for (const entry of entries) {
    const memberName = entry.member_name.trim() || 'Inconnu'
    const current = map.get(memberName) ?? { memberName, totalSalary: 0, totalObjects: 0, entries: [] }
    current.totalSalary += Math.max(0, Number(entry.salary_amount) || 0)
    current.totalObjects += Math.max(0, Number(entry.quantity) || 0)
    current.entries.push(entry)
    map.set(memberName, current)
  }
  return [...map.values()].sort((a, b) => b.totalSalary - a.totalSalary)
}

function summarizeMemberActivities(entries: ActivityEntry[]): MemberActivitySummary[] {
  const summaryMap = new Map<string, MemberActivitySummary>()
  for (const entry of entries) {
    const key = String(entry.activity_type || 'Inconnue').trim() || 'Inconnue'
    const current = summaryMap.get(key) ?? {
      activityType: key,
      runCount: 0,
      totalSalary: 0,
      totalObjects: 0,
      objectLines: [],
      equipmentLines: [],
      latestProof: entry.proof_image_data,
      latestAt: entry.created_at,
    }
    current.runCount += 1
    current.totalSalary += Math.max(0, Number(entry.salary_amount) || 0)
    current.totalObjects += Math.max(0, Number(entry.quantity) || 0)
    current.latestProof = new Date(entry.created_at) > new Date(current.latestAt) ? entry.proof_image_data : current.latestProof
    current.latestAt = new Date(entry.created_at) > new Date(current.latestAt) ? entry.created_at : current.latestAt

    const objName = String(entry.object_name || '').trim()
    if (objName) {
      const existing = current.objectLines.find((line) => line.name === objName)
      if (existing) existing.qty += Math.max(0, Number(entry.quantity) || 0)
      else current.objectLines.push({ name: objName, qty: Math.max(0, Number(entry.quantity) || 0) })
    }

    const equipParts = String(entry.equipment_name || '')
      .split('•')
      .map((part) => part.trim())
      .filter(Boolean)
    for (const rawEquip of equipParts) {
      const match = rawEquip.match(/^(.*)\sx(\d+)$/i)
      const name = (match?.[1] || rawEquip).trim()
      const qty = Math.max(1, Number(match?.[2] || 1) || 1)
      const existing = current.equipmentLines.find((line) => line.name === name)
      if (existing) existing.qty += qty
      else current.equipmentLines.push({ name, qty })
    }
    summaryMap.set(key, current)
  }
  return [...summaryMap.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt))
}

export default function ActivitesGestionChefPage() {
  const [data, setData] = useState<ActivityListResponse | null>(null)
  const [percentDraft, setPercentDraft] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    const session = getTenantSession()
    const allowed = expandAccessPrefixes(Array.isArray(session?.allowedPrefixes) ? session.allowedPrefixes : [])
    const isChef = Boolean(session?.isAdmin || allowed.includes('/') || allowed.includes('/activites/gestion-chef'))
    if (!isChef) {
      window.location.href = '/activites'
      return
    }
    void refresh()
    void listCatalogItemsUnified().then(setCatalogItems).catch(() => setCatalogItems([]))
  }, [])

  async function refresh() {
    try {
      const response = await listActivities({ scope: 'all' })
      setData(response)
      const initialPercent = Math.max(0.01, Number(response.settings.default_percent_per_object) || 2)
      setPercentDraft(String(initialPercent))
      setError(null)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.')
    }
  }

  async function saveDefaultPercent() {
    try {
      setSavingSettings(true)
      await updateActivitySettings({ default_percent_per_object: Math.max(0.01, Number(percentDraft) || 0.01) })
      await refresh()
      setOk('Pourcentage enregistré.')
    } catch (settingsError: unknown) {
      setError(settingsError instanceof Error ? settingsError.message : 'Impossible de modifier le % par défaut.')
    } finally {
      setSavingSettings(false)
    }
  }

  async function resetCurrentWeek() {
    if (!window.confirm('Réinitialiser toutes les activités de la semaine en cours ?')) return

    try {
      setResetting(true)
      await resetActivitiesCurrentWeek()
      await refresh()
      setOk('Semaine réinitialisée.')
    } catch (resetError: unknown) {
      setError(resetError instanceof Error ? resetError.message : 'Impossible de réinitialiser la semaine.')
    } finally {
      setResetting(false)
    }
  }

  const groupedForChef = useMemo(() => groupEntriesByMember(data?.entries ?? []), [data?.entries])
  const activitiesBubbleStats = useMemo(() => {
    const entries = data?.entries ?? []
    const todayIso = new Date().toISOString().slice(0, 10)
    const today = entries.filter((entry) => String(entry.created_at).slice(0, 10) === todayIso).length
    return { today, week: entries.length }
  }, [data?.entries])

  return (
    <div className="space-y-6">
      <PageHeader title={`${copy.activities.title} • Gestion chef`} subtitle="Toutes les activités centralisées par membre avec preuves et reset hebdo." />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-glow">
        <div className="space-y-2">
          <ActivitiesCategoryTabs active="activites" activitiesStats={activitiesBubbleStats} />
          <ActivitiesPageTabs active="chef" />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Réglages chef</h2>
            <p className="text-sm text-white/65">Semaine en cours (Lundi 00h → Dimanche 00h). Reset à faire le dimanche minuit si besoin.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-white/70">% par défaut</span>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              value={percentDraft}
              disabled={!data}
              onChange={(event) => setPercentDraft(event.target.value)}
            />
          </label>
          <Button variant="secondary" onClick={() => void saveDefaultPercent()} disabled={savingSettings || !data}>{savingSettings ? 'Enregistrement…' : 'Enregistrer le % par défaut'}</Button>
          <Button variant="ghost" onClick={() => void resetCurrentWeek()} disabled={resetting}>{resetting ? 'Reset…' : 'Reset semaine en cours'}</Button>
          {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <h2 className="text-xl font-semibold">Activités par membre</h2>
        <div className="mt-4 space-y-3">
          {groupedForChef.length === 0 ? <p className="text-sm text-white/65">Aucune activité enregistrée.</p> : null}

          {groupedForChef.map((member) => {
            const isOpen = expandedMember === member.memberName
            return (
              <article key={member.memberName} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <button
                  type="button"
                  onClick={() => setExpandedMember((prev) => (prev === member.memberName ? null : member.memberName))}
                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                >
                  <p className="text-sm font-semibold">{member.memberName}</p>
                  <p className="text-xs text-white/70">Objets: {member.totalObjects} • Salaire: {member.totalSalary.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $ • {isOpen ? 'Masquer' : 'Voir'}</p>
                </button>

                {isOpen ? (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {summarizeMemberActivities(member.entries).map((activitySummary) => {
                      return (
                        <div key={`${member.memberName}-${activitySummary.activityType}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                          <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                            <p className="mb-2 text-xs text-white/60">Dernière preuve ({new Date(activitySummary.latestAt).toLocaleString('fr-FR')})</p>
                            <Image src={activitySummary.latestProof} alt={`Preuve ${member.memberName}`} width={420} height={240} unoptimized className="h-44 w-full rounded-lg object-cover" />
                          </div>
                          <div className="space-y-2 text-sm">
                            <p><span className="text-white/65">Activité:</span> {activitySummary.activityType} ({activitySummary.runCount} run{activitySummary.runCount > 1 ? 's' : ''})</p>
                            <p><span className="text-white/65">Objets récupérés:</span> {activitySummary.totalObjects}</p>
                            <div>
                              <p className="text-white/65">Objets utilisés:</p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {activitySummary.objectLines.map((line) => {
                                  const objectCatalog = catalogItems.find((item) => item.name.trim().toLowerCase() === line.name.trim().toLowerCase())
                                  return (
                                    <span key={`${activitySummary.activityType}-obj-${line.name}`} className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2 py-1 text-xs">
                                      {objectCatalog?.image_url ? <Image src={objectCatalog.image_url} alt={line.name} width={16} height={16} className="h-4 w-4 rounded object-cover" unoptimized /> : null}
                                      {line.name} x{line.qty}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                            <div>
                              <p className="text-white/65">Équipements utilisés:</p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {activitySummary.equipmentLines.length === 0 ? <span className="text-xs text-white/55">—</span> : null}
                                {activitySummary.equipmentLines.map((line) => (
                                  <span key={`${activitySummary.activityType}-eq-${line.name}`} className="inline-flex rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-xs">{line.name} x{line.qty}</span>
                                ))}
                              </div>
                            </div>
                            <p><span className="text-white/65">Salaire cumulé:</span> {Math.max(0, Number(activitySummary.totalSalary) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
