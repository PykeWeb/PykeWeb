'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { loginTenant } from '@/lib/tenantAuthApi'
import { saveTenantSession } from '@/lib/tenantSession'
import { listActivePatchNotes, type PatchNote } from '@/lib/communicationApi'
import { PatchNoteModal } from '@/components/ui/PatchNoteModal'
import { PatchNotesRecapModal } from '@/components/ui/PatchNotesRecapModal'

const APP_VERSION = '1.0.0'

function isAdminGroup(group: { login: string; badge: string | null; name: string }) {
  const login = group.login.trim().toLowerCase()
  const badge = (group.badge || '').trim().toLowerCase()
  const name = group.name.trim().toLowerCase()
  return login === 'admin' || badge === 'admin' || name === 'administration'
}

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<PatchNote[]>([])
  const [entered, setEntered] = useState(false)
  const [selectedNote, setSelectedNote] = useState<PatchNote | null>(null)
  const [recapOpen, setRecapOpen] = useState(false)

  useEffect(() => {
    void listActivePatchNotes(50)
      .then(setNotes)
      .catch(() => setNotes([]))
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const latestNotes = useMemo(() => notes.slice(0, 3), [notes])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const group = await loginTenant(login, password)
      const isAdmin = isAdminGroup(group)
      const session = {
        groupId: isAdmin ? 'admin' : group.id,
        groupName: isAdmin ? 'Administration' : group.name,
        groupBadge: isAdmin ? 'ADMIN' : group.badge,
        isAdmin,
      }

      saveTenantSession(session)
      window.location.href = isAdmin ? '/admin/dashboard' : '/'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connexion impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="grid min-h-[85vh] place-items-center px-4">
        <div
          className={`w-full max-w-6xl rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-glow backdrop-blur transition-all duration-500 lg:p-8 ${
            entered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                  <Image src="/logo.png" alt="Pyke Stock" fill className="object-cover" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">Pyke Stock</h1>
                  <p className="text-sm text-white/65">Gestion de stock professionnelle</p>
                </div>
              </div>

              <p className="mt-8 text-base text-white/80">Connectez-vous à votre espace.</p>

              <form onSubmit={submit} className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                <div className="space-y-3">
                  <input
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="Identifiant"
                    className="h-11 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm text-white outline-none transition focus:border-white/35 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mot de passe"
                    className="h-11 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm text-white outline-none transition focus:border-white/35 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]"
                  />
                  {error ? <p className="text-sm text-rose-300">{error}</p> : null}
                  <button
                    disabled={loading}
                    className="h-11 w-full rounded-2xl border border-white/20 bg-gradient-to-r from-white/[0.18] to-white/[0.10] px-4 text-sm font-semibold text-white transition hover:from-white/[0.22] hover:to-white/[0.14]"
                  >
                    {loading ? 'Connexion…' : 'Se connecter'}
                  </button>
                </div>
              </form>

              <div className="mt-5 text-xs text-white/55">
                Version {APP_VERSION}
                <span className="mx-2 text-white/35">●</span>
                <span className="text-emerald-300">Système opérationnel</span>
              </div>
            </div>

            <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Dernières mises à jour</h2>
              <div className="mt-4 space-y-2">
                {latestNotes.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/65">Aucune mise à jour publiée.</p>
                ) : (
                  latestNotes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedNote(n)}
                      className="block w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]"
                    >
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="mt-1 text-xs text-white/55">{new Date(n.created_at).toLocaleDateString('fr-FR')}</p>
                      <p
                        className="mt-1 text-xs text-white/70 whitespace-pre-wrap"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {n.content}
                      </p>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => setRecapOpen(true)}
                className="mt-4 inline-flex h-10 items-center rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-medium text-white/85 transition hover:bg-white/[0.12]"
              >
                Voir tout →
              </button>
            </aside>
          </div>
        </div>
      </div>

      <PatchNotesRecapModal
        open={recapOpen}
        notes={notes}
        onClose={() => setRecapOpen(false)}
        onRead={(note) => {
          setRecapOpen(false)
          setSelectedNote(note)
        }}
      />
      <PatchNoteModal note={selectedNote} onClose={() => setSelectedNote(null)} />
    </>
  )
}
