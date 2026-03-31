'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { listCatalogItemsUnified, updateCatalogItem } from '@/lib/itemsApi'
import { listGroupLogs } from '@/lib/logsApi'
import { getTenantSession } from '@/lib/tenantSession'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import type { AppLogEntry } from '@/lib/types/logs'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR')
}

export default function CashPage() {
  const [cashItem, setCashItem] = useState<CatalogItem | null>(null)
  const [logs, setLogs] = useState<AppLogEntry[]>([])
  const [value, setValue] = useState('0')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const session = getTenantSession()
    if (!session) {
      window.location.href = '/login'
      return
    }

    void (async () => {
      try {
        setLoading(true)
        const [items, groupLogs] = await Promise.all([listCatalogItemsUnified(), listGroupLogs(300)])
        const cash = items.find((item) => String(item.name || '').trim().toLowerCase() === 'argent') || null
        setCashItem(cash)
        setValue(String(Math.max(0, Number(cash?.stock || 0))))
        setLogs(groupLogs)
        setError(null)
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : 'Impossible de charger la page argent.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const cashLogs = useMemo(() => logs.filter((entry) => {
    const payload = entry.payload && typeof entry.payload === 'object' ? entry.payload as Record<string, unknown> : null
    const hasCashMove = typeof payload?.cash_moved === 'number' || typeof payload?.cash_item_id === 'string'
    return entry.area === 'finance' || hasCashMove
  }), [logs])

  async function saveCash() {
    if (!cashItem) {
      setError('Item "argent" introuvable dans le catalogue.')
      return
    }
    const nextStock = Math.max(0, Number(value || 0))
    if (!Number.isFinite(nextStock)) {
      setError('Valeur invalide.')
      return
    }

    try {
      setSaving(true)
      await updateCatalogItem({
        id: cashItem.id,
        name: cashItem.name,
        category: cashItem.category,
        item_type: cashItem.item_type,
        description: cashItem.description || '',
        buy_price: cashItem.buy_price,
        sell_price: cashItem.sell_price,
        stock: nextStock,
        fivem_item_id: cashItem.fivem_item_id || '',
        internal_id: cashItem.internal_id,
      })
      setCashItem((prev) => (prev ? { ...prev, stock: nextStock } : prev))
      setError(null)
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible de mettre à jour le cash.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <PageHeader title="Argent du groupe" subtitle="Consulte, ajuste et audite l'utilisation du cash." />
        {loading ? <p className="mt-4 text-sm text-white/70">Chargement…</p> : null}

        {!loading ? (
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-sm text-white/70">Cash actuel (item &quot;argent&quot;)</p>
              <p className="mt-1 text-3xl font-semibold text-amber-100">{Math.max(0, Number(cashItem?.stock || 0)).toLocaleString('fr-FR')} $</p>
              <p className="mt-1 text-xs text-white/50">{cashItem ? `ID item: ${cashItem.id}` : 'Item argent introuvable'}</p>
            </div>
            <div className="flex items-end gap-2">
              <input value={value} onChange={(event) => setValue(event.target.value)} type="number" min={0} className="h-10 w-40 rounded-xl border border-white/20 bg-black/30 px-3 text-sm text-white" />
              <button type="button" onClick={() => void saveCash()} disabled={saving || !cashItem} className="h-10 rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-3 text-sm text-cyan-50 hover:bg-cyan-500/30 disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <h3 className="text-lg font-semibold">Historique cash / finance</h3>
        <div className="mt-3 space-y-2">
          {cashLogs.length === 0 ? <p className="text-sm text-white/60">Aucune activité cash.</p> : null}
          {cashLogs.slice(0, 80).map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <p className="text-white/65">{formatDate(entry.created_at)} • {entry.action}</p>
              <p className="font-medium text-white">{entry.message}</p>
            </div>
          ))}
        </div>
      </div>

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
