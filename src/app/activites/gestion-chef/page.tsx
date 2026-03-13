'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { listActivities, resetActivitiesCurrentWeek, updateActivitySettings, type ActivityListResponse } from '@/lib/activitiesApi'
import type { ActivityEntry } from '@/lib/types/activities'
import { copy } from '@/lib/copy'
import { getTenantSession } from '@/lib/tenantSession'

type GroupedMember = {
  memberName: string
  totalSalary: number
  totalObjects: number
  entries: ActivityEntry[]
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

export default function ActivitesGestionChefPage() {
  const [data, setData] = useState<ActivityListResponse | null>(null)
  const [percentDraft, setPercentDraft] = useState(2)
  const [savingSettings, setSavingSettings] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    const session = getTenantSession()
    const isChef = Boolean(session?.isAdmin || session?.role === 'chef')
    if (!isChef) {
      window.location.href = '/activites'
      return
    }
    void refresh()
  }, [])

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

  return (
    <div className="space-y-6">
      <PageHeader title={`${copy.activities.title} • Gestion chef`} subtitle="Toutes les activités centralisées par membre avec preuves et reset hebdo." />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Réglages chef</h2>
            <p className="text-sm text-white/65">Semaine en cours (Lundi 00h → Dimanche 00h). Reset à faire le dimanche minuit si besoin.</p>
          </div>
          <Link href="/activites" className="inline-flex h-10 items-center rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold hover:bg-white/[0.12]">
            Retour déclaration
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-white/70">% par défaut</span>
            <Input type="number" min={0.01} step={0.01} value={percentDraft} onChange={(event) => setPercentDraft(Math.max(0.01, Number(event.target.value) || 0.01))} />
          </label>
          <Button variant="secondary" onClick={() => void saveDefaultPercent()} disabled={savingSettings}>{savingSettings ? 'Enregistrement…' : 'Enregistrer le % par défaut'}</Button>
          <Button variant="ghost" onClick={() => void resetCurrentWeek()} disabled={resetting}>{resetting ? 'Reset…' : 'Reset semaine en cours'}</Button>
          {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <h2 className="text-xl font-semibold">Activités par membre</h2>
        <div className="mt-4 space-y-3">
          {groupedForChef.length === 0 ? <p className="text-sm text-white/65">Aucune activité cette semaine.</p> : null}

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
                  <div className="mt-3 space-y-3">
                    {member.entries.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <div className="grid gap-2 text-sm md:grid-cols-2">
                          <p><span className="text-white/65">Activité:</span> {entry.activity_type}</p>
                          <p><span className="text-white/65">Objet:</span> {entry.object_name} x{entry.quantity}</p>
                          <p><span className="text-white/65">Équipements:</span> {entry.equipment_name || '—'}</p>
                          <p><span className="text-white/65">Salaire:</span> {Math.max(0, Number(entry.salary_amount) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</p>
                        </div>
                        <div className="mt-2">
                          <p className="mb-2 text-xs text-white/60">Preuve</p>
                          <Image src={entry.proof_image_data} alt={`Preuve ${entry.member_name}`} width={360} height={220} unoptimized className="max-h-56 w-auto rounded-lg border border-white/10" />
                        </div>
                      </div>
                    ))}
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
