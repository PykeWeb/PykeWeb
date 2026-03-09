'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { PrimaryButton, SecondaryButton, SegmentedTabs } from '@/components/ui/design-system'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { GlassSelect } from '@/components/ui/GlassSelect'
import type { TabletRentalTicket } from '@/lib/tabletRental'
import type { AdminTabletAtelierStatsResponse, TabletCatalogItemConfig } from '@/lib/types/tablette'

type AdminRentalTicket = TabletRentalTicket & { group_name?: string | null; group_badge?: string | null }
type AdminTabletteView = 'service' | 'items'

function isSupportedImage(file: File) {
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)
}

export default function AdminTablettePage() {
  const [view, setView] = useState<AdminTabletteView>('items')
  const [rows, setRows] = useState<AdminRentalTicket[]>([])
  const [stats, setStats] = useState<AdminTabletAtelierStatsResponse | null>(null)
  const [items, setItems] = useState<TabletCatalogItemConfig[]>([])
  const [error, setError] = useState<string | null>(null)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null)
  const [imageDrafts, setImageDrafts] = useState<Record<string, File | null>>({})
  const [serviceCategory, setServiceCategory] = useState<'all' | 'pending' | 'resolved'>('all')
  const imageInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const filteredServiceRows = useMemo(() => {
    if (serviceCategory === 'all') return rows
    return rows.filter((row) => (serviceCategory === 'pending' ? row.status !== 'resolved' : row.status === 'resolved'))
  }, [rows, serviceCategory])

  const refresh = useCallback(async () => {
    const [rentalsRes, statsRes, itemsRes] = await Promise.all([
      fetch('/api/admin/tablette/rentals', withTenantSessionHeader({ cache: 'no-store' })),
      fetch('/api/admin/tablette/atelier', withTenantSessionHeader({ cache: 'no-store' })),
      fetch('/api/admin/tablette/items', withTenantSessionHeader({ cache: 'no-store' })),
    ])

    if (!rentalsRes.ok) {
      setError(await rentalsRes.text())
      return
    }
    if (!statsRes.ok) {
      setError(await statsRes.text())
      return
    }
    if (!itemsRes.ok) {
      setError(await itemsRes.text())
      return
    }

    const rentalsJson = (await rentalsRes.json()) as AdminRentalTicket[]
    const statsJson = (await statsRes.json()) as AdminTabletAtelierStatsResponse
    const itemsJson = (await itemsRes.json()) as TabletCatalogItemConfig[]

    setRows(rentalsJson)
    setStats(statsJson)
    setItems(itemsJson)
    setError(null)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function validateRow(row: AdminRentalTicket) {
    try {
      setValidatingId(row.id)
      const res = await fetch('/api/admin/tablette/rentals', {
        ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
        method: 'PATCH',
        body: JSON.stringify({ id: row.id, group_id: row.group_id, weeks: row.weeks }),
      })
      if (!res.ok) throw new Error(await res.text())
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Validation impossible')
    } finally {
      setValidatingId(null)
    }
  }

  async function saveItems() {
    try {
      setError(null)
      const res = await fetch('/api/admin/tablette/items', {
        ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
        method: 'PATCH',
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error(await res.text())
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sauvegarde items impossible')
    }
  }

  function addItem() {
    const key = `item_${Date.now().toString(36).slice(-6)}`
    setItems((prev) => [...prev, { key, name: 'Nouvel item', unit_price: 0, max_per_day: 2, image_url: null }])
    setImageDrafts((prev) => ({ ...prev, [key]: null }))
  }

  async function deleteItem(key: string) {
    try {
      const res = await fetch(`/api/admin/tablette/items?key=${encodeURIComponent(key)}`, {
        ...withTenantSessionHeader(),
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await res.text())
      setItems((prev) => prev.filter((item) => item.key !== key))
      setImageDrafts((prev) => ({ ...prev, [key]: null }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suppression item impossible')
    }
  }

  function setRowImageDraft(key: string, file: File | null) {
    if (file && !isSupportedImage(file)) {
      setError('Format non supporté (PNG/JPEG/WebP).')
      return
    }
    setError(null)
    setImageDrafts((prev) => ({ ...prev, [key]: file }))
  }

  async function uploadImageForItem(item: TabletCatalogItemConfig) {
    const file = imageDrafts[item.key]
    if (!file) return

    try {
      setUploadingImageKey(item.key)
      setError(null)

      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/admin/tablette/items/upload-image', {
        ...withTenantSessionHeader(),
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) throw new Error(await uploadRes.text())
      const uploadJson = (await uploadRes.json()) as { publicUrl: string }

      const persistRes = await fetch('/api/admin/tablette/items', {
        ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
        method: 'POST',
        body: JSON.stringify({ ...item, image_url: uploadJson.publicUrl }),
      })
      if (!persistRes.ok) throw new Error(await persistRes.text())

      setImageDrafts((prev) => ({ ...prev, [item.key]: null }))
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload image impossible')
    } finally {
      setUploadingImageKey(null)
    }
  }

  async function resetAllTabletRuns() {
    try {
      setResetting(true)
      const res = await fetch('/api/admin/tablette/atelier', {
        ...withTenantSessionHeader(),
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await res.text())
      setResetOpen(false)
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reset tablette impossible')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Admin • Tablette</h1>
            <p className="mt-1 text-sm text-white/70">Gestion séparée du service tablette et des items tablette journaliers.</p>
          </div>
          <SegmentedTabs
            options={[
              { value: 'items', label: 'Tablette items / jour' },
              { value: 'service', label: 'Achat service tablette' },
            ]}
            value={view}
            onChange={(value) => setView(value as AdminTabletteView)}
          />
        </div>
      </Panel>

      {view === 'items' ? (
        <>
          <Panel>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Items tablette (global)</h2>
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={addItem}>Ajouter item</SecondaryButton>
                <PrimaryButton onClick={() => void saveItems()}>Enregistrer items</PrimaryButton>
                <PrimaryButton onClick={() => setResetOpen(true)}>Reset tablettes (tous groupes)</PrimaryButton>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {items.map((item, index) => {
                const draft = imageDrafts[item.key]
                const uploading = uploadingImageKey === item.key
                return (
                  <div key={item.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_190px_130px_120px_auto_auto] md:items-center">
                      <Input value={item.name} onChange={(e) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} placeholder="Nom" />

                      <div
                        tabIndex={0}
                        onPaste={(event) => {
                          const clipboardItems = event.clipboardData?.items
                          if (!clipboardItems) return
                          for (const clipboardItem of clipboardItems) {
                            if (clipboardItem.kind !== 'file') continue
                            const pastedFile = clipboardItem.getAsFile()
                            if (!pastedFile) continue
                            setRowImageDraft(item.key, pastedFile)
                            event.preventDefault()
                            return
                          }
                        }}
                        className="h-12 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] outline-none focus:border-white/30"
                        onClick={() => imageInputRefs.current[item.key]?.click()}
                      >
                        <input
                          ref={(el) => {
                            imageInputRefs.current[item.key] = el
                          }}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={(event) => setRowImageDraft(item.key, event.target.files?.[0] ?? null)}
                        />
                        {draft ? (
                          <span className="inline-flex h-full w-full items-center justify-center text-xs text-emerald-200">Nouvelle image prête</span>
                        ) : item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt={item.name} className="h-full w-full bg-black/10 object-contain p-1" />
                        ) : (
                          <span className="inline-flex h-full w-full items-center justify-center text-xs text-white/50">Coller / choisir image</span>
                        )}
                      </div>

                      <Input value={String(item.unit_price)} onChange={(e) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, unit_price: Math.max(0, Number(e.target.value) || 0) } : row)))} inputMode="decimal" />
                      <Input value={String(item.max_per_day)} onChange={(e) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, max_per_day: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : row)))} inputMode="numeric" />

                      <PrimaryButton disabled={!draft || uploading} onClick={() => void uploadImageForItem(item)}>
                        {uploading ? 'Upload…' : 'Uploader image'}
                      </PrimaryButton>

                      <SecondaryButton onClick={() => void deleteItem(item.key)}>Supprimer</SecondaryButton>
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          {stats ? (
            <Panel>
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Stats items tablette</h2>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-white/60">Aujourd’hui ({stats.today})</p>
                    <p className="text-sm">Passages: <span className="font-semibold">{stats.totals.runs_today}</span></p>
                    <p className="text-sm">Items: <span className="font-semibold">{stats.totals.items_today}</span></p>
                    <p className="text-sm">Coût: <span className="font-semibold">{stats.totals.cost_today.toFixed(2)} $</span></p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-white/60">Semaine en cours</p>
                    <p className="text-sm">Passages: <span className="font-semibold">{stats.totals.runs_week}</span></p>
                    <p className="text-sm">Items: <span className="font-semibold">{stats.totals.items_week}</span></p>
                    <p className="text-sm">Coût: <span className="font-semibold">{stats.totals.cost_week.toFixed(2)} $</span></p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-white/60">Membres observés</p>
                    <p className="text-sm">Total: <span className="font-semibold">{stats.by_member.length}</span></p>
                    <p className="text-sm">Ont fait aujourd’hui: <span className="font-semibold">{stats.by_member.filter((m) => m.did_today).length}</span></p>
                    <p className="text-sm">N’ont pas fait aujourd’hui: <span className="font-semibold">{stats.by_member.filter((m) => !m.did_today).length}</span></p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-2 text-sm font-semibold">Items achetés par jour</p>
                    <div className="max-h-64 space-y-2 overflow-auto text-xs text-white/80">
                      {stats.by_day_items.map((row) => (
                        <div key={row.day_key} className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                          <p className="mb-1 font-semibold">{row.day_key}</p>
                          {row.items.map((entry) => <p key={`${row.day_key}-${entry.name}`}>{entry.name}: {entry.quantity}</p>)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-2 text-sm font-semibold">Items achetés par semaine</p>
                    <div className="max-h-64 space-y-2 overflow-auto text-xs text-white/80">
                      {stats.by_week_items.map((row) => (
                        <div key={row.week_key} className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                          <p className="mb-1 font-semibold">{row.week_key}</p>
                          {row.items.map((entry) => <p key={`${row.week_key}-${entry.name}`}>{entry.name}: {entry.quantity}</p>)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}
        </>
      ) : (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Catégorie Service</p>
              <h2 className="text-lg font-semibold">Achat service tablette</h2>
              <p className="mt-1 text-sm text-white/70">Validation des preuves d’achat pour le service tablette.</p>
            </div>
            <GlassSelect
              value={serviceCategory}
              onChange={(value) => setServiceCategory((value as 'all' | 'pending' | 'resolved'))}
              options={[
                { value: 'all', label: `Catégorie: Tous (${rows.length})` },
                { value: 'pending', label: `Catégorie: En attente (${rows.filter((row) => row.status !== 'resolved').length})` },
                { value: 'resolved', label: `Catégorie: Validés (${rows.filter((row) => row.status === 'resolved').length})` },
              ]}
              className="w-full md:w-[320px]"
            />
          </div>
          <div className="mt-3 space-y-3">
            {filteredServiceRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="mb-1 inline-flex rounded-full border border-cyan-300/30 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">Service</p>
                    <p className="font-semibold">{row.group_name || row.group_id} {row.group_badge ? `(${row.group_badge})` : ''}</p>
                    <p className="text-xs text-white/60">{row.weeks} semaine(s) · {row.amount.toFixed(2)} $</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.status !== 'resolved' ? (
                      <PrimaryButton disabled={validatingId === row.id} onClick={() => void validateRow(row)}>Valider</PrimaryButton>
                    ) : (
                      <SecondaryButton disabled>Déjà validé</SecondaryButton>
                    )}
                  </div>
                </div>
                {row.image_url ? (
                  <button type="button" className="mt-2" onClick={() => setPreviewImageUrl(row.image_url || null)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={row.image_url} alt="Preuve" className="h-28 w-auto rounded-lg border border-white/10 object-cover transition hover:opacity-90" />
                  </button>
                ) : null}
              </div>
            ))}
            {filteredServiceRows.length === 0 ? <p className="text-sm text-white/60">Aucune preuve dans cette catégorie.</p> : null}
          </div>
        </Panel>
      )}

      {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      {previewImageUrl ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPreviewImageUrl(null)}>
          <div className="max-h-[90vh] max-w-[90vw]" onClick={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImageUrl} alt="Preuve en grand" className="max-h-[90vh] max-w-[90vw] rounded-xl border border-white/10 object-contain" />
            <div className="mt-3 flex justify-end">
              <SecondaryButton onClick={() => setPreviewImageUrl(null)}>Fermer</SecondaryButton>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={resetOpen}
        title="Réinitialiser toutes les tablettes ?"
        description="Cette action supprime l’historique tablette items (tous groupes) pour repartir à zéro."
        confirmLabel="Réinitialiser"
        loading={resetting}
        onCancel={() => setResetOpen(false)}
        onConfirm={resetAllTabletRuns}
      />
    </div>
  )
}
