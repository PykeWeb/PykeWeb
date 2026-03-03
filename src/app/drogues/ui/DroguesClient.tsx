'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Calculator, Factory, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { listDrugItems, adjustDrugStock, updateDrugItem, deleteDrugItem, type DbDrugItem, type DrugKind } from '@/lib/drugsApi'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { DangerButton, PrimaryButton, SearchInput, SecondaryButton, SegmentedTabs } from '@/components/ui/design-system'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { StockTransactionModal } from '@/components/ui/StockTransactionModal'
import { LongPressReorderableRow } from '@/components/drag/LongPressReorderables'
import { getLayoutOrder, saveLayoutOrder } from '@/lib/uiLayoutsApi'
import { getTenantSession } from '@/lib/tenantSession'

const TAB_KEYS = ['catalogue', 'plantations', 'calculateur'] as const
type TabKey = (typeof TAB_KEYS)[number]

function kindLabel(k: DrugKind) {
  switch (k) {
    case 'drug':
      return 'Drogue'
    case 'seed':
      return 'Graine'
    case 'planting':
      return 'Plantation'
    case 'pouch':
      return 'Pochon'
    case 'other':
      return 'Autre'
    default:
      return 'Autre'
  }
}

type Recipe = {
  key: string
  title: string
  subtitle: string
  requirements: { name: string; qty: number }[]
  output: { name: string; qty: number; range?: [number, number] }
  note?: string
}

const RECIPES: Recipe[] = [
  {
    key: 'coke_leaf',
    title: 'Plantation coke (1 pot)',
    subtitle: '1 pot + 1 graine + 1 engrais + 3 eau = 1 feuille',
    requirements: [
      { name: 'Pot', qty: 1 },
      { name: 'Graine de coke', qty: 1 },
      { name: 'Engrais', qty: 1 },
      { name: 'Eau', qty: 3 },
    ],
    output: { name: 'Feuille de coke', qty: 1 },
    note: 'Stacks RP : 9 pots par stack + 2 lampes UV (par stack). Le calcul ci-dessus est “par pot”.',
  },
  {
    key: 'meth_brut',
    title: 'Cook meth (1 batch)',
    subtitle: 'Table + Meth + Batteries + chimie = 10 à 30 meth brut',
    requirements: [
      { name: 'Table', qty: 1 },
      { name: 'Meth', qty: 1 },
      { name: 'Batterie', qty: 2 },
      { name: 'Ammoniaque', qty: 16 },
      { name: 'Methylamine', qty: 15 },
    ],
    output: { name: 'Meth brut', qty: 0, range: [10, 30] },
    note: 'Output aléatoire : entre 10 et 30 meth brut par batch. (Tu peux ajuster plus tard si besoin.)',
  },
]

function findByKeyword(items: DbDrugItem[], keyword: string) {
  const k = keyword.toLowerCase()
  return items.filter((it) => (it.name || '').toLowerCase().includes(k))
}

type CalcMode = 'coke' | 'meth'

type CalculatorResult = {
  requirements: { label: string; qty: number; unitPrice: number | null; subtotal: number | null }[]
  totalKnown: number
  hasMissingPrices: boolean
  missingPrices: string[]
}

function findPriceByKeywords(items: DbDrugItem[], keywords: string[]): number | null {
  const normalized = keywords.map((k) => k.toLowerCase())
  const match = items.find((item) => {
    const name = (item.name || '').toLowerCase()
    return normalized.some((kw) => name.includes(kw))
  })
  if (!match) return null
  const price = Number(match.price)
  return Number.isFinite(price) && price > 0 ? price : null
}

function buildCalculatorResult(mode: CalcMode, qty: number, items: DbDrugItem[]): CalculatorResult {
  if (mode === 'coke') {
    const requirements = [
      { label: 'Pots', qty, unitPrice: 10 },
      { label: 'Fertilisant', qty, unitPrice: 10 },
      { label: 'Lampes', qty: Math.ceil(qty / 9), unitPrice: 36 },
      { label: 'Eau', qty: qty * 3, unitPrice: findPriceByKeywords(items, ['eau', 'water']) },
    ]
    const normalized = requirements.map((req) => ({
      label: req.label,
      qty: req.qty,
      unitPrice: req.unitPrice,
      subtotal: req.unitPrice === null ? null : req.qty * req.unitPrice,
    }))
    const missingPrices = normalized.filter((req) => req.unitPrice === null).map((req) => req.label)
    const totalKnown = normalized.reduce((sum, req) => sum + (req.subtotal ?? 0), 0)
    return { requirements: normalized, totalKnown, hasMissingPrices: missingPrices.length > 0, missingPrices }
  }

  const requirements = [
    { label: 'Tables', qty, unitPrice: findPriceByKeywords(items, ['table']) },
    { label: 'Meth', qty, unitPrice: findPriceByKeywords(items, ['meth']) },
    { label: 'Batteries', qty: qty * 2, unitPrice: findPriceByKeywords(items, ['batterie', 'battery']) },
    { label: 'Ammoniaque', qty: qty * 16, unitPrice: findPriceByKeywords(items, ['ammoniaque']) },
    { label: 'Methylamine', qty: qty * 15, unitPrice: findPriceByKeywords(items, ['methylamine']) },
  ]
  const normalized = requirements.map((req) => ({
    label: req.label,
    qty: req.qty,
    unitPrice: req.unitPrice,
    subtotal: req.unitPrice === null ? null : req.qty * req.unitPrice,
  }))
  const missingPrices = normalized.filter((req) => req.unitPrice === null).map((req) => req.label)
  const totalKnown = normalized.reduce((sum, req) => sum + (req.subtotal ?? 0), 0)
  return { requirements: normalized, totalKnown, hasMissingPrices: missingPrices.length > 0, missingPrices }
}

export default function DroguesClient() {
  const [tab, setTab] = useState<TabKey>('catalogue')
  const [items, setItems] = useState<DbDrugItem[]>([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<DrugKind | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DbDrugItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [editingItem, setEditingItem] = useState<DbDrugItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<DrugKind>('other')
  const [editPrice, setEditPrice] = useState('')
  const [editStock, setEditStock] = useState('0')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [calcMode, setCalcMode] = useState<CalcMode>('coke')
  const [calcQuantity, setCalcQuantity] = useState(1)
  const [actionOrder, setActionOrder] = useState(['purchase', 'sale', 'edit', 'delete'])
  const [txModal, setTxModal] = useState<{ item: DbDrugItem; kind: 'purchase' | 'sale' } | null>(null)
  const session = getTenantSession()
  const layoutScope = session?.isAdmin ? 'global' : 'group'

  async function refresh() {
    setLoading(true)
    try {
      setItems(await listDrugItems())
    } catch (e: any) {
      setError(e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    void (async () => {
      const saved = await getLayoutOrder('drogues.actions')
      if (saved.length) setActionOrder(saved)
    })()
  }, [])

  const filtered = useMemo(() => {
    let arr = items
    if (kind !== 'all') arr = arr.filter((it) => it.type === kind)
    const q = query.trim().toLowerCase()
    if (!q) return arr
    return arr.filter((o) => (o.name || '').toLowerCase().includes(q))
  }, [items, query, kind])

  const possibleBatches = useMemo(() => {
    const res: Record<string, number> = {}
    for (const r of RECIPES) {
      const limits: number[] = []
      for (const req of r.requirements) {
        const matches = findByKeyword(items, req.name)
        const totalStock = matches.reduce((sum, it) => sum + (it.stock || 0), 0)
        limits.push(Math.floor(totalStock / req.qty))
      }
      res[r.key] = limits.length ? Math.max(0, Math.min(...limits)) : 0
    }
    return res
  }, [items])

  const producedCokeLeaves = useMemo(() => {
    const list = findByKeyword(items, 'Feuille de coke')
    return list.reduce((sum, it) => sum + Number(it.stock || 0), 0)
  }, [items])

  const calculatorResult = useMemo(() => buildCalculatorResult(calcMode, Math.max(1, Math.floor(calcQuantity || 1)), items), [calcMode, calcQuantity, items])

  const producedMethBrut = useMemo(() => {
    const list = findByKeyword(items, 'Meth brut')
    return list.reduce((sum, it) => sum + Number(it.stock || 0), 0)
  }, [items])

  function startEdit(item: DbDrugItem) {
    setEditingItem(item)
    setEditName(item.name || '')
    setEditType(item.type)
    setEditPrice(String(item.price ?? 0))
    setEditStock(String(Math.max(0, Number(item.stock ?? 0))))
    setEditImageFile(null)
    setError(null)
  }

  function cancelEdit() {
    setEditingItem(null)
    setEditName('')
    setEditType('other')
    setEditPrice('')
    setEditStock('0')
    setEditImageFile(null)
  }

  async function saveEdit() {
    if (!editingItem) return
    if (!editName.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    if (Number.isNaN(Number(editPrice)) || Number(editPrice) < 0) {
      setError('Le prix doit être un nombre positif.')
      return
    }

    try {
      setSavingEdit(true)
      setError(null)
      await updateDrugItem({
        id: editingItem.id,
        type: editType,
        name: editName.trim(),
        price: Number(editPrice),
        quantity: Math.max(0, Math.floor(Number(editStock || 0) || 0)),
        imageFile: editImageFile,
      })
      await refresh()
      cancelEdit()
    } catch (e: any) {
      setError(e?.message || 'Erreur modification')
    } finally {
      setSavingEdit(false)
    }
  }

  async function removeItem() {
    if (!pendingDelete) return
    try {
      setDeleting(true)
      setError(null)
      await deleteDrugItem(pendingDelete.id)
      await refresh()
      setPendingDelete(null)
    } catch (e: any) {
      setError(e?.message || 'Erreur suppression')
    } finally {
      setDeleting(false)
    }
  }

  async function produce(recipe: Recipe) {
    const batches = possibleBatches[recipe.key] ?? 0
    if (batches <= 0) return

    setError(null)
    setBusyId(recipe.key)

    try {
      for (const req of recipe.requirements) {
        let remaining = req.qty
        const matches = findByKeyword(items, req.name).sort((a, b) => (b.stock || 0) - (a.stock || 0))
        for (const it of matches) {
          if (remaining <= 0) break
          const take = Math.min(it.stock || 0, remaining)
          if (take > 0) {
            await adjustDrugStock({ itemId: it.id, delta: -take, note: `Production: ${recipe.title}` })
            remaining -= take
          }
        }
      }

      const outMatches = findByKeyword(items, recipe.output.name)
      if (outMatches.length === 0) {
        throw new Error(`Crée l'item output “${recipe.output.name}” dans le catalogue pour recevoir la production.`)
      }
      const delta = recipe.output.range
        ? Math.floor(Math.random() * (recipe.output.range[1] - recipe.output.range[0] + 1)) + recipe.output.range[0]
        : recipe.output.qty

      await adjustDrugStock({
        itemId: outMatches[0].id,
        delta,
        note: `Production: ${recipe.title}`,
      })

      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Erreur')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs options={[{ value: 'catalogue', label: 'Catalogue' }, { value: 'plantations', label: 'Plantations' }, { value: 'calculateur', label: 'Calculateur' }]} value={tab} onChange={setTab} />

          <div className="flex items-center gap-2">
            <Link href="/drogues/nouveau"><PrimaryButton size="lg">Ajouter un item</PrimaryButton></Link>
          </div>
        </div>

        {tab === 'catalogue' ? (
          <>
            {editingItem ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Modifier l’item : {editingItem.name}</p>
                  <div className="flex items-center gap-2">
                    <SecondaryButton type="button" onClick={cancelEdit}>Annuler</SecondaryButton>
                    <PrimaryButton type="button" disabled={savingEdit} onClick={saveEdit}>{savingEdit ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-xs text-white/60">Nom</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Type</label>
                    <GlassSelect
                      className="mt-1"
                      value={editType}
                      onChange={(v) => setEditType(v as DrugKind)}
                      options={[{ value: 'drug', label: 'Drogue' }, { value: 'seed', label: 'Graine' }, { value: 'planting', label: 'Plantation' }, { value: 'pouch', label: 'Pochon' }, { value: 'other', label: 'Autre' }]}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Prix</label>
                    <input
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      inputMode="decimal"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Quantité</label>
                    <input
                      value={editStock}
                      onChange={(e) => setEditStock(e.target.value)}
                      inputMode="numeric"
                      className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm outline-none focus:border-white/30"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-white/60">Image actuelle</p>
                  <div className="mt-1 h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {editingItem.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={editingItem.image_url} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                </div>

                <ImageDropzone label="Remplacer l’image (optionnel)" onChange={setEditImageFile} />
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} className="w-[300px]" placeholder="Rechercher…" />

              <GlassSelect
                value={kind}
                onChange={(v) => setKind(v as any)}
                options={[{ value: 'all', label: 'Tous' }, { value: 'drug', label: 'Drogue' }, { value: 'seed', label: 'Graine' }, { value: 'planting', label: 'Plantation' }, { value: 'pouch', label: 'Pochons / vente' }, { value: 'other', label: 'Autre' }]}
              />

              <div className="text-sm text-white/60">{filtered.length} item(s)</div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-white/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Prix</th>
                    <th className="px-4 py-3 text-left font-medium">Stock</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-white/60">
                        Chargement…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-white/60">
                        Aucun item pour le moment.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((it) => (
                      <tr key={it.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                              {it.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div>
                              <div className="font-semibold">{it.name}</div>
                              {it.description ? <div className="text-xs text-white/60 line-clamp-1">{it.description}</div> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{kindLabel(it.type)}</td>
                        <td className="px-4 py-3">{Number(it.price).toFixed(2)} $</td>
                        <td className="px-4 py-3">{it.stock}</td>
                        <td className="px-4 py-3">
                          <LongPressReorderableRow
                                order={actionOrder}
                            onOrderChange={async (next) => {
                              setActionOrder(next)
                              await saveLayoutOrder('drogues.actions', next, layoutScope)
                            }}
                            className="flex items-center justify-end gap-2"
                            items={[
                              { id: 'purchase', element: <SecondaryButton disabled={busyId === it.id} onClick={() => setTxModal({ item: it, kind: 'purchase' })} icon={<ShoppingCart className="h-4 w-4" />}>Achat</SecondaryButton> },
                              { id: 'sale', element: <SecondaryButton disabled={busyId === it.id} onClick={() => setTxModal({ item: it, kind: 'sale' })} icon={<ArrowUpRight className="h-4 w-4" />}>Sortie</SecondaryButton> },
                              { id: 'edit', element: <SecondaryButton onClick={() => startEdit(it)} icon={<Pencil className="h-4 w-4" />}>Modifier</SecondaryButton> },
                              { id: 'delete', element: <DangerButton onClick={() => setPendingDelete(it)} icon={<Trash2 className="h-4 w-4" />}>Supprimer</DangerButton> },
                            ]}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : tab === 'plantations' ? (
          <>
            <div className="mt-4">
              <DraggablePlantations
                producedCokeLeaves={producedCokeLeaves}
                producedMethBrut={producedMethBrut}
                recipes={RECIPES}
                possibleBatches={possibleBatches}
                busyId={busyId}
                onProduce={produce}
              />
            </div>
          </>
        ) : null}

        {tab === 'calculateur' ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-white/80" />
            <p className="text-sm font-semibold">📟 Calculateur</p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-white/60">Type</label>
              <GlassSelect
                className="mt-1"
                value={calcMode}
                onChange={(v) => setCalcMode(v as CalcMode)}
                options={[{ value: 'coke', label: 'Coke' }, { value: 'meth', label: 'Meth' }]}
              />
            </div>

            <div>
              <label className="text-xs text-white/60">{calcMode === 'coke' ? 'Nombre de graines de coke' : 'Nombre de machines à meth'}</label>
              <input
                type="number"
                min={1}
                step={1}
                value={calcQuantity}
                onChange={(e) => setCalcQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <p className="font-semibold">Résultat ({calcMode === 'coke' ? 'Coke' : 'Meth'})</p>
            <div className="mt-2 space-y-1 text-white/80">
              <div className="grid grid-cols-[minmax(120px,1fr)_88px_110px_110px] gap-3 border-b border-white/10 pb-1 text-[11px] uppercase tracking-wide text-white/50">
                <span>Item</span>
                <span className="text-right">Qté</span>
                <span className="text-right">Prix/u</span>
                <span className="text-right">Sous-total</span>
              </div>
              {calculatorResult.requirements.map((req) => (
                <div key={req.label} className="grid grid-cols-[minmax(120px,1fr)_88px_110px_110px] gap-3">
                  <span>{req.label}</span>
                  <span className="text-right text-xs text-white/70">x{req.qty}</span>
                  <span className="text-right text-xs text-white/70">{req.unitPrice === null ? 'Prix manquant' : `${req.unitPrice.toFixed(0)}$/u`}</span>
                  <span className="text-right text-xs text-white/70">{req.subtotal === null ? '—' : `${req.subtotal.toFixed(0)}$`}</span>
                </div>
              ))}
            </div>

            <p className="mt-3 font-semibold text-emerald-300">
              💰 Prix : {calculatorResult.totalKnown.toFixed(0)}$ {calculatorResult.hasMissingPrices ? 'sans le(s) prix manquant(s)' : ''}
            </p>

            {calculatorResult.missingPrices.length ? (
              <p className="mt-2 text-amber-300">⚠️ Prix manquants : {calculatorResult.missingPrices.join(', ')}</p>
            ) : null}
          </div>
        </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            ❌ {error}
          </div>
        ) : null}
      </Panel>
      <StockTransactionModal
        open={!!txModal}
        kind={txModal?.kind || 'purchase'}
        title={txModal?.item.name || 'Item'}
        stock={txModal?.item.stock || 0}
        unitPrice={txModal?.item.price || 0}
        loading={busyId !== null}
        onClose={() => setTxModal(null)}
        onSubmit={async (quantity) => {
          if (!txModal) return
          setBusyId(txModal.item.id)
          setError(null)
          try {
            await adjustDrugStock({ itemId: txModal.item.id, delta: txModal.kind === 'purchase' ? quantity : -quantity, note: txModal.kind === 'purchase' ? 'Entrée' : 'Sortie' })
            await refresh()
          } catch (e: any) {
            setError(e?.message || 'Erreur')
          } finally {
            setBusyId(null)
            setTxModal(null)
          }
        }}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Supprimer cet objet ?"
        description="Cette action est définitive. L’objet et ses transactions associées seront supprimés."
        loading={deleting}
        onCancel={() => (!deleting ? setPendingDelete(null) : null)}
        onConfirm={removeItem}
      />
    </div>
  )
}

function DraggablePlantations({
  producedCokeLeaves,
  producedMethBrut,
  recipes,
  possibleBatches,
  busyId,
  onProduce
}: {
  producedCokeLeaves: number
  producedMethBrut: number
  recipes: Recipe[]
  possibleBatches: Record<string, number>
  busyId: string | null
  onProduce: (recipe: Recipe) => Promise<void>
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-white/80" />
          <p className="text-sm font-semibold">Production en stock</p>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <span>Feuille de coke</span>
            <span className="font-semibold">{producedCokeLeaves}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <span>Meth brut</span>
            <span className="font-semibold">{producedMethBrut}</span>
          </div>
        </div>
      </div>

      {recipes.map((r) => {
        const canDo = (possibleBatches[r.key] ?? 0) > 0
        return (
          <div key={r.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold">{r.title}</p>
            <p className="mt-1 text-xs text-white/60">{r.subtitle}</p>

            <div className="mt-3 max-w-md space-y-2 text-xs text-white/70">
              {r.requirements.map((req) => (
                <div key={req.name} className="grid grid-cols-2 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <span className="truncate">{req.name}</span>
                  <span className="pr-1 text-right">× {req.qty}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
              Output : {r.output.name}{' '}
              {r.output.range ? `(${r.output.range[0]} à ${r.output.range[1]})` : `× ${r.output.qty}`}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-white/60">Batches possibles : {possibleBatches[r.key] ?? 0}</span>
              <button
                disabled={!canDo || busyId === r.key}
                onClick={() => onProduce(r)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Produire
              </button>
            </div>

            {r.note ? <p className="mt-2 text-[11px] text-white/50">{r.note}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
