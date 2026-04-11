'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { DangerButton, PrimaryButton, SearchInput, SecondaryButton } from '@/components/ui/design-system'
import { getTenantSession } from '@/lib/tenantSession'
import { deleteGroupWebhookUrl, getGroupWebhookStatus, listGroupLogs, listGroupLogsSummary, saveGroupWebhookUrl, testGroupWebhook } from '@/lib/logsApi'
import type { AppLogActionType, AppLogCategory, AppLogEntry, GroupLogsSummary, GroupWebhookStatus } from '@/lib/types/logs'
import { sessionCanAccessPrefix, sessionCanManageSensitiveGroupSettings } from '@/lib/sessionAccess'

const CATEGORY_OPTIONS: Array<{ value: AppLogCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'finance', label: 'Finance' },
  { value: 'stock', label: 'Stock' },
  { value: 'drugs', label: 'Drogues' },
  { value: 'weapons', label: 'Armes' },
  { value: 'admin', label: 'Admin' },
  { value: 'discord', label: 'Discord' },
  { value: 'system', label: 'Système' },
]

const ACTION_OPTIONS: Array<{ value: AppLogActionType | 'all'; label: string }> = [
  { value: 'all', label: 'Toutes actions' },
  { value: 'creation', label: 'Création' },
  { value: 'modification', label: 'Modification' },
  { value: 'suppression', label: 'Suppression' },
  { value: 'entree', label: 'Entrée' },
  { value: 'sortie', label: 'Sortie' },
  { value: 'achat', label: 'Achat' },
  { value: 'vente', label: 'Vente' },
  { value: 'depot', label: 'Dépôt' },
  { value: 'retrait', label: 'Retrait' },
  { value: 'pret', label: 'Prêt' },
  { value: 'retour', label: 'Retour' },
  { value: 'webhook_configuration', label: 'Config webhook' },
  { value: 'webhook_test', label: 'Test webhook' },
  { value: 'permission_modifiee', label: 'Permission modifiée' },
  { value: 'autre', label: 'Autre' },
]

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR')
}

function amountLabel(value: number | null | undefined) {
  if (value == null) return '—'
  return `${value.toLocaleString('fr-FR')} $`
}

function badgeClass(action: AppLogActionType) {
  if (['entree', 'depot', 'creation', 'achat', 'retour'].includes(action)) return 'border-emerald-300/35 bg-emerald-500/20 text-emerald-100'
  if (['sortie', 'retrait', 'suppression', 'vente', 'pret'].includes(action)) return 'border-rose-300/35 bg-rose-500/20 text-rose-100'
  if (['modification', 'permission_modifiee'].includes(action)) return 'border-amber-300/35 bg-amber-500/20 text-amber-100'
  return 'border-sky-300/35 bg-sky-500/20 text-sky-100'
}

export default function LogsPage() {
  const [rows, setRows] = useState<AppLogEntry[]>([])
  const [summary, setSummary] = useState<GroupLogsSummary | null>(null)
  const [webhookStatus, setWebhookStatus] = useState<GroupWebhookStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingWebhook, setSavingWebhook] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [webhookInput, setWebhookInput] = useState('')
  const [query, setQuery] = useState('')
  const [member, setMember] = useState('')
  const [category, setCategory] = useState<AppLogCategory | 'all'>('all')
  const [actionType, setActionType] = useState<AppLogActionType | 'all'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const [session] = useState(() => getTenantSession())
  const canAccessLogs = sessionCanAccessPrefix(session, '/logs')
  const canManageWebhook = sessionCanManageSensitiveGroupSettings(session)

  const loadData = useCallback(async (overrides?: {
    query?: string
    member?: string
    category?: AppLogCategory | 'all'
    actionType?: AppLogActionType | 'all'
    startDate?: string
    endDate?: string
  }) => {
    try {
      setLoading(true)
      setError(null)
      const [nextRows, nextSummary, nextWebhook] = await Promise.all([
        listGroupLogs({
          query: overrides?.query ?? query,
          member: overrides?.member ?? member,
          category: overrides?.category ?? category,
          actionType: overrides?.actionType ?? actionType,
          startDate: overrides?.startDate ?? startDate,
          endDate: overrides?.endDate ?? endDate,
          limit: 250,
        }),
        listGroupLogsSummary(),
        getGroupWebhookStatus(),
      ])
      setRows(nextRows)
      setSummary(nextSummary)
      setWebhookStatus(nextWebhook)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les logs.')
    } finally {
      setLoading(false)
    }
  }, [actionType, category, endDate, member, query, startDate])

  useEffect(() => {
    if (!session) {
      window.location.href = '/login'
      return
    }
    if (!canAccessLogs) {
      window.location.href = '/'
      return
    }
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const memberOptions = useMemo(() => {
    const names = new Set<string>()
    rows.forEach((row) => {
      const name = (row.user_name || row.actor_name || '').trim()
      if (name) names.add(name)
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [rows])

  async function onSaveWebhook() {
    if (!webhookInput.trim()) return
    try {
      setSavingWebhook(true)
      const status = await saveGroupWebhookUrl(webhookInput.trim())
      setWebhookStatus(status)
      setWebhookInput('')
      setToast('Webhook enregistré.')
      await loadData()
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible de sauvegarder le webhook.')
    } finally {
      setSavingWebhook(false)
    }
  }

  async function onDeleteWebhook() {
    try {
      setSavingWebhook(true)
      const status = await deleteGroupWebhookUrl()
      setWebhookStatus(status)
      setToast('Webhook supprimé.')
      await loadData()
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible de supprimer le webhook.')
    } finally {
      setSavingWebhook(false)
    }
  }

  async function onTestWebhook() {
    try {
      setTestingWebhook(true)
      const result = await testGroupWebhook()
      setWebhookStatus(result.status)
      setToast('Test webhook envoyé.')
      await loadData()
    } catch (testError: unknown) {
      setError(testError instanceof Error ? testError.message : 'Test webhook impossible.')
    } finally {
      setTestingWebhook(false)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PageHeader title="Logs / Audit" subtitle="Centre d’audit du groupe: activité, finance, admin et Discord." />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Panel><p className="text-xs text-white/60">Logs aujourd’hui</p><p className="mt-2 text-2xl font-semibold">{summary?.todayCount ?? '—'}</p></Panel>
        <Panel><p className="text-xs text-white/60">Mouvements finance</p><p className="mt-2 text-2xl font-semibold">{summary?.todayFinanceMovements ?? '—'}</p></Panel>
        <Panel><p className="text-xs text-white/60">Dernière activité</p><p className="mt-2 text-sm">{formatDate(summary?.lastActivityAt)}</p></Panel>
        <Panel><p className="text-xs text-white/60">Dernier retrait</p><p className="mt-2 text-sm">{summary?.lastWithdrawal ? `${amountLabel(summary.lastWithdrawal.amount)} • ${formatDate(summary.lastWithdrawal.created_at)}` : '—'}</p></Panel>
        <Panel><p className="text-xs text-white/60">Dernier membre actif</p><p className="mt-2 text-sm">{summary?.lastActiveMember ? `${summary.lastActiveMember.memberName} • ${formatDate(summary.lastActiveMember.createdAt)}` : '—'}</p></Panel>
      </div>

      {canManageWebhook ? (
        <Panel>
          <h2 className="text-base font-semibold">Configuration Discord</h2>
          <p className="mt-1 text-sm text-white/65">Webhook Discord propre à votre groupe. Jamais exposé en clair côté client.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <input
              value={webhookInput}
              onChange={(event) => setWebhookInput(event.target.value)}
              placeholder={webhookStatus?.maskedWebhookUrl || 'https://discord.com/api/webhooks/...'}
              className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm text-white outline-none"
            />
            <PrimaryButton onClick={onSaveWebhook} disabled={savingWebhook || !webhookInput.trim()}>{savingWebhook ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>
            <SecondaryButton onClick={onTestWebhook} disabled={testingWebhook || !webhookStatus?.configured}>{testingWebhook ? 'Test…' : 'Tester webhook'}</SecondaryButton>
            <DangerButton onClick={onDeleteWebhook} disabled={savingWebhook || !webhookStatus?.configured}>Supprimer</DangerButton>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1">Statut: {webhookStatus?.configured ? 'configuré' : 'non configuré'}</span>
            <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1">Validité: {webhookStatus?.valid == null ? 'inconnue' : webhookStatus.valid ? 'valide' : 'invalide'}</span>
            <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1">URL: {webhookStatus?.maskedWebhookUrl || '—'}</span>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <h2 className="text-base font-semibold">Filtres</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Recherche texte…" className="max-w-none" />
          <select value={member} onChange={(event) => setMember(event.target.value)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm">
            <option value="">Tous les pseudos</option>
            {memberOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value as AppLogCategory | 'all')} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm">
            {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={actionType} onChange={(event) => setActionType(event.target.value as AppLogActionType | 'all')} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm">
            {ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
          <div className="flex gap-2">
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 flex-1 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
            <PrimaryButton onClick={() => void loadData()} disabled={loading}>Appliquer</PrimaryButton>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Historique des logs</h2><span className="text-xs text-white/60">{rows.length} entrée(s)</span></div>
        <div className="space-y-3">
          {loading ? <p className="text-sm text-white/70">Chargement…</p> : rows.length === 0 ? <p className="text-sm text-white/70">Aucun log.</p> : rows.map((log) => (
            <article key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white/65">[{formatDate(log.created_at)}]</p>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass(log.action_type)}`}>{log.action_type}</span>
              </div>
              <p className="mt-2 text-sm"><span className="font-semibold">{log.user_name || log.actor_name || 'Membre inconnu'}</span> a effectué <span className="font-semibold">{log.action}</span></p>
              <div className="mt-2 grid gap-1 text-xs text-white/80 md:grid-cols-2 xl:grid-cols-3">
                <p>Élément : <span className="text-white">{log.target_name || log.entity_type || '—'}</span></p>
                <p>Source : <span className="text-white">{log.source}</span></p>
                <p>Quantité : <span className="text-white">{log.quantity ?? '—'}</span></p>
                <p>Montant : <span className="text-white">{amountLabel(log.amount)}</span></p>
                <p>Pseudo : <span className="text-white">{log.user_name || log.actor_name || '—'}</span></p>
                <p>Avant : <span className="text-white">{log.before_value || '—'}</span></p>
                <p>Après : <span className="text-white">{log.after_value || '—'}</span></p>
                <p>Note : <span className="text-white">{log.note || '—'}</span></p>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      {toast ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">{toast}</p> : null}
      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
