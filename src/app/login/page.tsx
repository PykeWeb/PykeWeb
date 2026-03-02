'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { loginTenant } from '@/lib/tenantAuthApi'
import { saveTenantSession } from '@/lib/tenantSession'
import { listActivePatchNotes, type PatchNote } from '@/lib/communicationApi'
import { Shield, Users, Clock3, Database, LayoutDashboard, Lock } from 'lucide-react'

const SUPERADMIN_LOGIN = 'admin'
const SUPERADMIN_PASSWORD = 'santa1234'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<PatchNote[]>([])

  useEffect(() => {
    void listActivePatchNotes(3)
      .then(setNotes)
      .catch(() => setNotes([]))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (login === SUPERADMIN_LOGIN && password === SUPERADMIN_PASSWORD) {
        saveTenantSession({
          groupId: 'admin',
          groupName: 'Administration',
          groupBadge: 'ADMIN',
          isAdmin: true,
        })
        window.location.href = '/admin/groupes'
        return
      }

      const group = await loginTenant(login, password)
      saveTenantSession({
        groupId: group.id,
        groupName: group.name,
        groupBadge: group.badge,
        isAdmin: false,
      })
      window.location.href = '/'
    } catch (err: any) {
      setError(err?.message || 'Connexion impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-[85vh] place-items-center">
      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div>
              <h1 className="text-2xl font-bold">Portail multi-groupes</h1>
              <p className="mt-2 text-sm text-white/70">
                Connexion sécurisée par groupe avec données isolées, statut actif et échéance de paiement.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" /> 1 groupe = 1 espace</p>
                <p className="mt-1 text-white/70">Chaque groupe voit uniquement ses propres données.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium"><Database className="h-4 w-4" /> Stockage en ligne</p>
                <p className="mt-1 text-white/70">Objets, armes, transactions et dépenses sont sur Supabase.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4" /> Gestion des accès</p>
                <p className="mt-1 text-white/70">Active, désactive, prolonge ou passe un groupe en illimité.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium"><LayoutDashboard className="h-4 w-4" /> Admin central</p>
                <p className="mt-1 text-white/70">Une page admin pour gérer tous les groupes en un endroit.</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              <p className="flex items-center gap-2 font-semibold text-white"><Lock className="h-4 w-4" /> Patch notes récentes</p>
              {notes.length === 0 ? (
                <p className="mt-1">Aucune note publiée.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {notes.map((n) => (
                    <li key={n.id}>• <span className="font-medium text-white">{n.title}</span> — {new Date(n.created_at).toLocaleDateString('fr-FR')}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Connexion</h2>
            <p className="mt-1 text-xs text-white/60">Utilise l'identifiant du groupe (ou admin).</p>
            <div className="mt-4 space-y-3">
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Identifiant"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              <button disabled={loading} className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold">
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
