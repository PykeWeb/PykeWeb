'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { loginTenant } from '@/lib/tenantAuthApi'
import { saveTenantSession } from '@/lib/tenantSession'
import { Shield, Users } from 'lucide-react'

const SUPERADMIN_LOGIN = 'admin'
const SUPERADMIN_PASSWORD = 'santa1234'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h1 className="text-2xl font-bold">Portail multi-groupes</h1>
            <p className="mt-2 text-sm text-white/70">Connexion sécurisée par groupe avec données isolées, statut actif et échéance de paiement.</p>
            <div className="mt-4 space-y-3 text-sm text-white/80">
              <div className="flex items-center gap-2"><Users className="h-4 w-4" /> Un espace indépendant par groupe</div>
              <div className="flex items-center gap-2"><Shield className="h-4 w-4" /> Gestion admin globale</div>
            </div>
          </div>

          <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Connexion</h2>
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
