'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ArrowDownRight, ArrowUpRight, Pencil, ShoppingCart, Trash2 } from 'lucide-react';
import { listObjects, updateObject, deleteObject } from '@/lib/objectsApi';
import { ImageDropzone } from '@/components/objets/ImageDropzone';
import { currentGroupId } from '@/lib/tenantScope';
import { PrimaryButton, SecondaryButton, DangerButton, SearchInput, SegmentedTabs } from '@/components/ui/design-system';

type ObjRow = {
  id: string;
  name: string | null;
  price: number | null;
  stock: number | null;
  image_url: string | null;
};

type TxItemRow = {
  name_snapshot: string | null;
  quantity: number | null;
};

type TxRow = {
  id: string;
  type: 'purchase' | 'sale' | string;
  total: number | null;
  counterparty: string | null;
  created_at: string;
  transaction_items?: TxItemRow[] | null;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars');
  return createClient(url, anon);
}

function money(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(2)} $`;
}

export default function ObjetsClient() {
  const sp = useSearchParams();

  const [tab, setTab] = useState<'catalogue' | 'transactions'>('catalogue');
  const [q, setQ] = useState('');
  const [objs, setObjs] = useState<ObjRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingObj, setEditingObj] = useState<ObjRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // allow opening /objets?tab=transactions
  useEffect(() => {
    const t = sp.get('tab');
    if (t === 'transactions') setTab('transactions');
  }, [sp]);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);
        const supabase = getSupabase();

        const [{ data: tData }, mergedObjects] = await Promise.all([
          supabase
            .from('transactions')
            .select('id,type,total,counterparty,created_at,transaction_items(name_snapshot,quantity)')
            .eq('group_id', currentGroupId())
            .order('created_at', { ascending: false })
            .limit(25),
          listObjects(),
        ]);

        if (!alive) return;
        setObjs((mergedObjects ?? []) as ObjRow[]);
        setTxs((tData ?? []) as TxRow[]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return objs;
    return objs.filter((o) => (o.name ?? '').toLowerCase().includes(s));
  }, [objs, q]);


  function startEdit(o: ObjRow) {
    setEditingObj(o);
    setEditName(o.name ?? '');
    setEditPrice(String(o.price ?? 0));
    setEditImageFile(null);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingObj(null);
    setEditName('');
    setEditPrice('');
    setEditImageFile(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editingObj) return;
    if (!editName.trim()) {
      setEditError('Le nom est obligatoire.');
      return;
    }
    if (Number.isNaN(Number(editPrice)) || Number(editPrice) < 0) {
      setEditError('Le prix doit être un nombre positif.');
      return;
    }

    try {
      setSavingEdit(true);
      setEditError(null);
      await updateObject({
        id: editingObj.id,
        name: editName.trim(),
        price: Number(editPrice),
        imageFile: editImageFile,
      });

      setObjs((await listObjects()) as ObjRow[]);
      cancelEdit();
    } catch (e: any) {
      setEditError(e?.message || 'Impossible de modifier cet objet.');
    } finally {
      setSavingEdit(false);
    }
  }



  async function removeObject(o: ObjRow) {
    if (!window.confirm(`Supprimer définitivement "${o.name ?? 'cet objet'}" ?`)) return;
    try {
      await deleteObject(o.id);
      setObjs((await listObjects()) as ObjRow[]);
    } catch (e: any) {
      setEditError(e?.message || 'Impossible de supprimer cet objet.');
    }
  }

  const todayTxCount = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    return txs.filter((t) => {
      const dt = new Date(t.created_at);
      return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    }).length;
  }, [txs]);

  return (
    <div className="space-y-4">
      {/* Main */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href="/">
              <SecondaryButton>← Retour</SecondaryButton>
            </Link>
            <SegmentedTabs
              options={[{ value: 'catalogue', label: 'Catalogue' }, { value: 'transactions', label: 'Transactions' }]}
              value={tab}
              onChange={setTab}
            />
          </div>
          <Link href="/objets/nouveau">
            <PrimaryButton size="lg">Ajouter un objet</PrimaryButton>
          </Link>
        </div>

        {tab === 'catalogue' ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <SearchInput
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher (nom)..."
                  className="w-[320px]"
                />
                <div className="text-sm text-white/60">{filtered.length} objet(s)</div>
              </div>
              <div className="text-sm text-white/50">
                Astuce : utilise <b>Achat</b> pour entrer du stock et <b>Sortie</b> pour retirer.
              </div>
            </div>


            {editingObj ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Modifier l’objet : {editingObj.name ?? 'Sans nom'}</p>
                  <div className="flex items-center gap-2">
                    <SecondaryButton type="button" onClick={cancelEdit}>Annuler</SecondaryButton>
                    <PrimaryButton type="button" disabled={savingEdit} onClick={saveEdit}>{savingEdit ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-white/60">Nom</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
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
                </div>

                <div className="mt-3">
                  <p className="text-xs text-white/60">Image actuelle</p>
                  <div className="mt-1 h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {editingObj.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={editingObj.image_url} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                </div>

                <ImageDropzone label="Remplacer l’image (optionnel)" onChange={setEditImageFile} />

                {editError ? <p className="mt-2 text-sm text-rose-200">{editError}</p> : null}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="px-4 py-3 text-left">Objet</th>
                    <th className="px-4 py-3 text-left">Prix</th>
                    <th className="px-4 py-3 text-left">Stock</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-white/60" colSpan={5}>
                        Chargement...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-white/60" colSpan={5}>
                        Aucun objet pour le moment.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((o) => (
                      <tr key={o.id} className="border-t border-white/10">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                              {o.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img alt="" src={o.image_url} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="font-medium">{o.name ?? '—'}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{money(o.price)}</td>
                        <td className="px-4 py-3">{o.stock ?? 0}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/transactions/nouveau?prefill=${encodeURIComponent(o.id)}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                            >
                              <ShoppingCart className="h-4 w-4" />
                              Achat
                            </Link>
                            <Link
                              href={`/transactions/sortie?prefill=${encodeURIComponent(o.id)}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                              Sortie
                            </Link>
                            <button
                              type="button"
                              onClick={() => startEdit(o)}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                            >
                              <Pencil className="h-4 w-4" />
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => removeObject(o)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-500/20"
                            >
                              <Trash2 className="h-4 w-4" />
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* mini cards inside main */}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/60">Transactions</div>
                    <div className="mt-1 text-2xl font-semibold">{todayTxCount}</div>
                    <div className="text-xs text-white/50">aujourd’hui</div>
                  </div>
                  <button
                    onClick={() => setTab('transactions')}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                  >
                    Voir
                  </button>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-white/70">Dernières transactions</div>
              <div className="flex items-center gap-2">
                <Link href="/transactions/nouveau" className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">
                  Nouvel achat
                </Link>
                <Link href="/transactions/sortie" className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">
                  Nouvelle sortie
                </Link>
              </div>
            </div>


            {editingObj ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Modifier l’objet : {editingObj.name ?? 'Sans nom'}</p>
                  <div className="flex items-center gap-2">
                    <SecondaryButton type="button" onClick={cancelEdit}>Annuler</SecondaryButton>
                    <PrimaryButton type="button" disabled={savingEdit} onClick={saveEdit}>{savingEdit ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-white/60">Nom</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
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
                </div>

                <div className="mt-3">
                  <p className="text-xs text-white/60">Image actuelle</p>
                  <div className="mt-1 h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {editingObj.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={editingObj.image_url} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                </div>

                <ImageDropzone label="Remplacer l’image (optionnel)" onChange={setEditImageFile} />

                {editError ? <p className="mt-2 text-sm text-rose-200">{editError}</p> : null}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Objets</th>
                    <th className="px-4 py-3 text-left">Partenaire</th>
                    <th className="px-4 py-3 text-left">Total</th>
                    <th className="px-4 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-white/60" colSpan={5}>
                        Chargement...
                      </td>
                    </tr>
                  ) : txs.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-white/60" colSpan={5}>
                        Aucune transaction pour le moment.
                      </td>
                    </tr>
                  ) : (
                    txs.map((t) => (
                      <tr key={t.id} className="border-t border-white/10">
                        <td className="px-4 py-3">
                          {t.type === 'purchase' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100">
                              <ArrowDownRight className="h-3.5 w-3.5" /> Entrée
                            </span>
                          ) : t.type === 'sale' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-orange-300/40 bg-orange-500/10 px-2 py-1 text-xs text-orange-100">
                              <ArrowUpRight className="h-3.5 w-3.5" /> Sortie
                            </span>
                          ) : (
                            t.type
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/80">
                          {t.transaction_items?.length
                            ? t.transaction_items
                                .map((item) => `${item.name_snapshot ?? 'Objet'} ×${item.quantity ?? 0}`)
                                .join(', ')
                            : '—'}
                        </td>
                        <td className="px-4 py-3">{t.counterparty ?? '—'}</td>
                        <td className="px-4 py-3">{money(t.total)}</td>
                        <td className="px-4 py-3 text-right text-white/70">
                          {new Date(t.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
