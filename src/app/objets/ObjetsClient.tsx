'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

type ObjRow = {
  id: string;
  name: string | null;
  price: number | null;
  stock: number | null;
  image_url: string | null;
};

type TxRow = {
  id: string;
  type: 'purchase' | 'sale' | string;
  total: number | null;
  counterparty: string | null;
  notes: string | null;
  created_at: string;
};

function TxBadge({ type }: { type: TxRow['type'] }) {
  const isPurchase = type === 'purchase';
  const isSale = type === 'sale';
  const label = isPurchase ? 'Achat' : isSale ? 'Sortie' : String(type);
  const Icon = isPurchase ? ArrowDownRight : ArrowUpRight;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80">
      {(isPurchase || isSale) ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}

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
  const router = useRouter();
  const sp = useSearchParams();

  const [tab, setTab] = useState<'catalogue' | 'transactions'>('catalogue');
  const [q, setQ] = useState('');
  const [objs, setObjs] = useState<ObjRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);

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

        const [{ data: oData }, { data: tData }] = await Promise.all([
          supabase.from('objects').select('id,name,price,stock,image_url').order('created_at', { ascending: false }),
          supabase
            .from('transactions')
            .select('id,type,total,counterparty,notes,created_at')
            .order('created_at', { ascending: false })
            .limit(25),
        ]);

        if (!alive) return;
        setObjs((oData ?? []) as ObjRow[]);
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
            <Link href="/" className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">
              ← Retour
            </Link>
            <button
              onClick={() => setTab('catalogue')}
              className={`rounded-xl px-3 py-1.5 text-sm border border-white/10 ${tab === 'catalogue' ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'}`}
            >
              Catalogue
            </button>
            <button
              onClick={() => setTab('transactions')}
              className={`rounded-xl px-3 py-1.5 text-sm border border-white/10 ${tab === 'transactions' ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'}`}
            >
              Transactions
            </button>
            <Link
              href="/objets/nouveau"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            >
              Ajouter un objet
            </Link>
          </div>
        </div>

        {tab === 'catalogue' ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher (nom)..."
                  className="h-10 w-72 max-w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none placeholder:text-white/40 focus:bg-white/10"
                />
                <div className="text-sm text-white/60">{filtered.length} objet(s)</div>
              </div>
              <div className="text-xs text-white/50">
                Astuce : utilise <b>Achat</b> pour entrer du stock et <b>Sortie</b> pour retirer.
              </div>
            </div>

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
                      <td className="px-4 py-6 text-white/60" colSpan={4}>
                        Chargement...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-white/60" colSpan={4}>
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
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                            >
                              Achat
                            </Link>
                            <Link
                              href={`/transactions/sortie?prefill=${encodeURIComponent(o.id)}`}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                            >
                              Sortie
                            </Link>
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

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Mode RP</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-white/70">
                  <li>Achat : tu ajoutes au stock + le total te dit combien payer</li>
                  <li>Sortie : tu retires du stock (vente / perte / transfert)</li>
                  <li>Historique : utile pour justifier qui a pris quoi et quand</li>
                </ul>
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

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Partenaire</th>
                    <th className="px-4 py-3 text-left">Description</th>
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
                          <TxBadge type={t.type} />
                        </td>
                        <td className="px-4 py-3">{t.counterparty ?? '—'}</td>
                        <td className="px-4 py-3 text-white/80">
                          <span className="block max-w-[520px] truncate">{t.notes ?? '—'}</span>
                        </td>
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
