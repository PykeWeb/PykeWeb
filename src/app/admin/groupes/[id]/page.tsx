'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type ClipboardEvent } from 'react'
import { useParams } from 'next/navigation'
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { deleteTenantGroup, getTenantGroup, resetTenantGroupData, updateTenantGroup, type TenantGroup } from '@/lib/tenantAuthApi'
import { getTenantSession } from '@/lib/tenantSession'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { copyToClipboard, generatePassword } from '@/lib/utils/password'

function formatAccessRemaining(paidUntil: string | null) {
  if (!paidUntil) return 'Accès illimité'
  const paidUntilDate = new Date(paidUntil)
  if (Number.isNaN(paidUntilDate.getTime())) return 'Expiration invalide'

  const remainingMs = paidUntilDate.getTime() - Date.now()
  if (remainingMs <= 0) return 'Accès expiré'

  const totalMinutes = Math.floor(remainingMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}j ${hours}h restantes`
  if (hours > 0) return `${hours}h ${minutes}m restantes`
  return `${minutes}m restantes`
}

export default function AdminGroupDetailsPage() {
  const params = useParams<{ id: string }>()
  const groupId = params?.id

  const [group, setGroup] = useState<TenantGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groupPasswordVisible, setGroupPasswordVisible] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const refresh = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    try {
      const groupRow = await getTenantGroup(groupId)
      setGroup(groupRow)
      setError(null)
    } catch (e: unknown) {
      setGroup(null)
      setError(e instanceof Error ? e.message : 'Impossible de charger le groupe.')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    const session = getTenantSession()
    if (!(session?.isAdmin || session?.groupId === 'admin')) {
      window.location.href = '/'
      return
    }
    void refresh()
  }, [refresh])

  async function savePatch(patch: Partial<TenantGroup>) {
    if (!group) return
    try {
      setBusy(true)
      await updateTenantGroup(group.id, patch)
      await refresh()
      toast.success('Groupe mis à jour.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Modification impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadGroupLogo(file: File | null) {
    if (!group || !file) return
    try {
      setUploadingLogo(true)
      const preparedFile = await prepareLogoFile(file)
      const formData = new FormData()
      formData.set('file', preparedFile)
      const uploadRes = await fetch('/api/admin/groups/upload-image', {
        method: 'POST',
        body: formData,
      })
      const raw = await uploadRes.text()
      let uploadJson: { publicUrl?: string; error?: string } = {}
      try {
        uploadJson = JSON.parse(raw) as { publicUrl?: string; error?: string }
      } catch {
        uploadJson = { error: raw || 'Upload logo impossible.' }
      }
      if (!uploadRes.ok || !uploadJson.publicUrl) throw new Error(uploadJson.error || 'Upload logo impossible.')
      await savePatch({ image_url: uploadJson.publicUrl } as Partial<TenantGroup>)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload logo impossible.')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function prepareLogoFile(file: File) {
    const maxBytes = 2_000_000
    if (file.size <= maxBytes) return file

    const objectUrl = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Image invalide.'))
        img.src = objectUrl
      })

      const maxSide = 1200
      const ratio = Math.min(1, maxSide / Math.max(image.width, image.height))
      const width = Math.max(1, Math.round(image.width * ratio))
      const height = Math.max(1, Math.round(image.height * ratio))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas non disponible pour compresser l’image.')
      ctx.drawImage(image, 0, 0, width, height)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (!result) reject(new Error('Compression impossible.'))
          else resolve(result)
        }, 'image/webp', 0.82)
      })
      if (blob.size > maxBytes) throw new Error('Image trop lourde même après compression. Vise moins de 2 Mo.')
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'group-logo'}.webp`, { type: 'image/webp' })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  async function onPasteLogo(event: ClipboardEvent<HTMLDivElement>) {
    const imageItem = [...event.clipboardData.items].find((item) => item.type.startsWith('image/'))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    event.preventDefault()
    await uploadGroupLogo(file)
  }

  async function addDays() {
    if (!group) return
    const rawDays = window.prompt('Ajouter combien de jours ?', '7')
    if (rawDays === null) return
    const days = Number(rawDays)
    if (!Number.isFinite(days) || days <= 0) {
      setError('Nombre de jours invalide.')
      return
    }
    const baseTs = group.paid_until ? new Date(group.paid_until).getTime() : Date.now()
    const next = new Date(Math.max(Date.now(), baseTs) + days * 24 * 60 * 60 * 1000)
    await savePatch({ paid_until: next.toISOString() })
  }

  async function resetGroupData() {
    if (!group) return
    if (!window.confirm(`Réinitialiser toutes les données du groupe ${group.name} sans supprimer le compte ?`)) return
    try {
      setBusy(true)
      await resetTenantGroupData(group.id)
      await refresh()
      toast.success('Le groupe a été remis à neuf.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reset impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteGroup() {
    if (!group) return
    if (!window.confirm(`Supprimer définitivement le groupe ${group.name} ?`)) return
    try {
      setBusy(true)
      await deleteTenantGroup(group.id)
      window.location.href = '/admin/groupes'
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suppression impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">Chargement du groupe…</div>
  }

  if (!group) {
    return <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-sm text-rose-100">{error || 'Groupe introuvable.'}</div>
  }

  return (
    <div className="space-y-6">
      <div id="section-general" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader title={`Gestion : ${group.name}${group.badge ? ` (${group.badge})` : ''}`} subtitle="Général du groupe (nom, badge, identifiant, expiration, actions)." size="compact" />
          <Link href="/admin/groupes" className="inline-flex h-10 items-center rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold hover:bg-white/[0.12]">Retour</Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm md:col-span-3">
            <span className="mb-1 block text-white/70">Logo du groupe</span>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] p-3" onPaste={(event) => void onPasteLogo(event)} tabIndex={0}>
              <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-white/15 bg-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={group.image_url || '/logo.png'} alt={`Logo ${group.name}`} className="h-full w-full object-cover" />
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => void uploadGroupLogo(e.target.files?.[0] || null)}
                disabled={busy || uploadingLogo}
                className="text-sm text-white/90 file:mr-3 file:rounded-xl file:border file:border-white/20 file:bg-white/[0.08] file:px-3 file:py-2 file:text-xs file:text-white"
              />
              <button
                type="button"
                disabled={busy || uploadingLogo}
                onClick={() => void savePatch({ image_url: null } as Partial<TenantGroup>)}
                className="h-9 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadingLogo ? 'Upload…' : 'Retirer logo'}
              </button>
              <p className="text-xs text-white/60">Tu peux aussi coller une image avec Ctrl+V.</p>
            </div>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-white/70">Nom</span>
            <input defaultValue={group.name} onBlur={(e) => void savePatch({ name: e.target.value.trim() || group.name })} className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-white/70">Badge</span>
            <input defaultValue={group.badge || ''} onBlur={(e) => void savePatch({ badge: e.target.value.trim() || null })} className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-white/70">Identifiant</span>
            <input defaultValue={group.login} onBlur={(e) => void savePatch({ login: e.target.value.trim() || group.login })} className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" />
          </label>
        </div>

        <div className="mt-3">
          <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-3">
            <label className="mb-1 block text-xs uppercase tracking-wide text-white/65">Mot de passe chef</label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <input
                defaultValue={group.password}
                type={groupPasswordVisible ? 'text' : 'password'}
                onBlur={(e) => void savePatch({ password: e.target.value.trim() || group.password })}
                className="h-10 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-sm text-white"
              />
              <button type="button" onClick={() => setGroupPasswordVisible((v) => !v)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.07] px-3 text-xs text-white/90 hover:bg-white/[0.14]">
                {groupPasswordVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {groupPasswordVisible ? 'Masquer' : 'Voir'}
              </button>
              <button
                type="button"
                onClick={async (event) => {
                  const container = event.currentTarget.closest('div')
                  const input = container?.querySelector('input')
                  if (!(input instanceof HTMLInputElement)) return
                  const next = generatePassword({ avoidAmbiguous: true })
                  input.value = next
                  await savePatch({ password: next })
                }}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.07] px-3 text-xs text-white/90 hover:bg-white/[0.14]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Générer
              </button>
              <button
                type="button"
                onClick={async (event) => {
                  const container = event.currentTarget.closest('div')
                  const input = container?.querySelector('input')
                  const value = input instanceof HTMLInputElement ? input.value : ''
                  const copied = await copyToClipboard(value)
                  if (copied) toast.success('Mot de passe chef copié.')
                  else toast.error('Impossible de copier.')
                }}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.07] px-3 text-xs text-white/90 hover:bg-white/[0.14]"
              >
                <Copy className="h-3.5 w-3.5" />
                Copier
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-1 text-sm text-white/80">
              <p>Expire le: <span className="font-semibold text-white">{group.paid_until ? new Date(group.paid_until).toLocaleString('fr-FR') : 'Jamais'}</span></p>
              <p>Temps restant: <span className="font-semibold text-cyan-100">{formatAccessRemaining(group.paid_until)}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => void addDays()} className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">+ Jours</button>
              <button disabled={busy} onClick={() => void savePatch({ paid_until: null })} className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">Illimité</button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => void savePatch({ active: !group.active })} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm hover:bg-white/[0.12]">{group.active ? 'Désactiver' : 'Activer'}</button>
          <button disabled={busy} onClick={() => void resetGroupData()} className="h-10 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 text-sm text-amber-100 hover:bg-amber-500/20">Reset groupe</button>
          <button disabled={busy} onClick={() => void deleteGroup()} className="h-10 rounded-2xl border border-rose-300/30 bg-rose-500/12 px-4 text-sm text-rose-100 hover:bg-rose-500/22">Supprimer groupe</button>
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
        <p className="font-semibold">Gestion interne déléguée au Boss du groupe</p>
        <p className="mt-1 text-cyan-50/85">
          Les rôles et membres internes se gèrent directement depuis l’espace client du groupe, menu <span className="font-semibold">“Gestion du groupe”</span>.
        </p>
      </div>

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
