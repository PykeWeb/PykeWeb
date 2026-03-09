'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { PrimaryButton, SecondaryButton, SegmentedTabs } from '@/components/ui/design-system'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import type { TabletRentalTicket } from '@/lib/tabletRental'
import type { AdminTabletAtelierStatsResponse, TabletCatalogItemConfig } from '@/lib/types/tablette'

type AdminRentalTicket = TabletRentalTicket & { group_name?: string | null; group_badge?: string | null }
type AdminTabletteView = 'service' | 'items'

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
  const [selectedItemKey, setSelectedItemKey] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)

  const selectedItemExists = useMemo(() => items.some((item) => item.key === selectedItemKey), [items, selectedItemKey])

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
    if (!itemsJson.some((item) => item.key === selectedItemKey)) {
      setSelectedItemKey(itemsJson[0]?.key ?? '')
    }
    setError(null)
  }, [selectedItemKey])

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
    setSelectedItemKey(key)
  }

  async function deleteItem(key: string) {
    try {
      const res = await fetch(`/api/admin/tablette/items?key=${encodeURIComponent(key)}`, {
        ...withTenantSessionHeader(),
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await res.text())
      setItems((prev) => prev.filter((item) => item.key !== key))
      if (selectedItemKey === key) setSelectedItemKey('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suppression item impossible')
    }
  }

  async function uploadImageToSelectedItem() {
    if (!selectedItemExists || !uploadFile) return
    try {
      setUploadingImage(true)
      setError(null)
      setUploadNotice(null)
      const target = items.find((item) => item.key === selectedItemKey)
      if (!target) throw new Error('Item cible introuvable.')

      const formData = new FormData()
      formData.append('file', uploadFile)
      const res = await fetch('/api/admin/tablette/items/upload-image', {
        ...withTenantSessionHeader(),
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(await res.text())
      const json = (await res.json()) as { publicUrl: string }

      const persistRes = await fetch('/api/admin/tablette/items', {
        ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
        method: 'POST',
        body: JSON.stringify({ ...target, image_url: json.publicUrl }),
      })
      if (!persistRes.ok) throw new Error(await persistRes.text())

      setUploadFile(null)
      setUploadNotice('Image enregistrée sur l’item.')
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload image impossible')
    } finally {
      setUploadingImage(false)
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

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-2 text-sm font-semibold">Image item (copier/coller ou import PNG/JPEG/WebP)</p>
              <div className="grid gap-3 md:grid-cols-[260px_1fr_auto] md:items-end">
                <GlassSelect
                  value={selectedItemKey}
                  onChange={setSelectedItemKey}
                  options={items.map((item) => ({ value: item.key, label: `${item.name} (${item.key})` }))}
                  placeholder="Item cible"
                />
                <ImageDropzone label="Image" onChange={setUploadFile} />
                <PrimaryButton disabled={!selectedItemExists || !uploadFile || uploadingImage} onClick={() => void uploadImageToSelectedItem()}>
                  {uploadingImage ? 'Upload…' : 'Uploader image'}
                </PrimaryButton>
              </div>
              {uploadNotice ? <p className="mt-2 text-sm text-emerald-200">{uploadNotice}</p> : null}
            </div>

            <div className="mt-3 space-y-2">
              {items.map((item, index) => (
                <div key={item.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="grid gap-2 md:grid-cols-[minmax(200px,1fr)_180px_130px_130px_auto]">
                    <Input value={item.name} onChange={(e) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} placeholder="Nom" />
                    <button
                      type="button"
                      className="flex h-10 items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-3 text-left text-sm text-white/80"
                      onClick={() => item.image_url && setPreviewImageUrl(item.image_url)}
                    >
                      {item.image_url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.image_url} alt={item.name} className="h-7 w-7 rounded-md object-cover" />
                          <span className="truncate">Image enregistrée</span>
                        </>
                      ) : (
                        <span className="text-white/50">Sans image</span>
                      )}
                    </button>
                    <Input value={String(item.unit_price)} onChange={(e) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, unit_price: Math.max(0, Number(e.target.value) || 0) } : row)))} inputMode="decimal" />
                    <Input value={String(item.max_per_day)} onChange={(e) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, max_per_day: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : row)))} inputMode="numeric" />
                    <SecondaryButton onClick={() => void deleteItem(item.key)}>Supprimer</SecondaryButton>
                  </div>
                </div>
              ))}
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
                          {row.items.map((item) => <p key={`${row.day_key}-${item.name}`}>{item.name}: {item.quantity}</p>)}
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
                          {row.items.map((item) => <p key={`${row.week_key}-${item.name}`}>{item.name}: {item.quantity}</p>)}
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
          <h2 className="text-lg font-semibold">Achat service tablette</h2>
          <p className="mt-1 text-sm text-white/70">Validation des preuves d’achat pour le service tablette.</p>
          <div className="mt-3 space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
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
            {rows.length === 0 ? <p className="text-sm text-white/60">Aucune preuve reçue.</p> : null}
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
