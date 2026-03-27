/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { listObjects, type DbObject } from '@/lib/objectsApi'
import { createTransaction, type TxType, type TxLineInput } from '@/lib/transactionsApi'
import { Loader2, Upload, RefreshCcw, CheckCircle2, AlertTriangle, Plus, Trash2 } from 'lucide-react'

type ScanAction = 'entry' | 'exit' | 'purchase' | 'sale'

type ScanDetectedItem = {
  detected_label: string
  matched_item_id: string | null
  matched_item_name: string | null
  estimated_quantity: number
  confidence: number
  alternatives: Array<{ item_id: string; item_name: string }>
  reasoning?: string
}

type DraftLine = {
  key: string
  itemId: string | null
  quantity: number
  confidence: number
  detectedLabel: string
}

const actionLabels: Record<ScanAction, string> = {
  entry: 'Entrée',
  exit: 'Sortie',
  purchase: 'Achat',
  sale: 'Vente',
}

const transactionTypeByAction: Record<ScanAction, TxType> = {
  entry: 'purchase',
  purchase: 'purchase',
  exit: 'sale',
  sale: 'sale',
}

function confidenceText(v: number) {
  if (v >= 0.85) return 'Élevée'
  if (v >= 0.6) return 'Moyenne'
  return 'Faible'
}

export default function ScanInventaireClient() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [detectedItems, setDetectedItems] = useState<ScanDetectedItem[]>([])
  const [globalConfidence, setGlobalConfidence] = useState(0)
  const [action, setAction] = useState<ScanAction | null>(null)
  const [objects, setObjects] = useState<DbObject[]>([])
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [counterparty, setCounterparty] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null)

  const localObjects = useMemo(() => objects.filter((item) => !item.id.startsWith('global:')), [objects])
  const objectMap = useMemo(() => new Map(localObjects.map((item) => [item.id, item])), [localObjects])

  const totalEstimated = useMemo(() => {
    return draftLines.reduce((acc, line) => {
      const item = line.itemId ? objectMap.get(line.itemId) : null
      return acc + (item?.price ?? 0) * line.quantity
    }, 0)
  }, [draftLines, objectMap])

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = event.clipboardData?.files
      if (!files || files.length === 0) return
      const image = Array.from(files).find((item) => item.type.startsWith('image/')) ?? null
      if (!image) return
      onSelectFile(image)
      setAssistantMessage('Image collée depuis le presse-papiers.')
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  function onSelectFile(nextFile: File | null) {
    if (!nextFile) return
    setFile(nextFile)
    setPreviewUrl(URL.createObjectURL(nextFile))
    setStep(1)
    setAnalysisError(null)
    setSubmitError(null)
    setSubmitMessage(null)
  }

  async function runAnalysis() {
    if (!file) {
      setAnalysisError('Ajoute une image avant de lancer l’analyse.')
      return
    }

    try {
      setIsAnalyzing(true)
      setAnalysisError(null)
      setStep(2)

      const form = new FormData()
      form.append('image', file)

      const res = await fetch('/api/scan-inventaire', {
        method: 'POST',
        body: form,
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || 'Analyse impossible.')
      }

      const detected: ScanDetectedItem[] = Array.isArray(payload?.scan?.items) ? payload.scan.items : []
      const confidence = Number(payload?.scan?.global_confidence ?? 0)
      const objList = await listObjects()

      setObjects(objList)
      setDetectedItems(detected)
      setGlobalConfidence(confidence)
      setDraftLines(
        detected.map((item, index) => ({
          key: `${Date.now()}-${index}`,
          itemId: item.matched_item_id,
          quantity: Math.max(0, Math.floor(Number(item.estimated_quantity) || 0)),
          confidence: item.confidence,
          detectedLabel: item.detected_label,
        }))
      )
      setStep(3)
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Analyse impossible.')
      setDetectedItems([])
    } finally {
      setIsAnalyzing(false)
    }
  }

  function pickAction(next: ScanAction) {
    setAction(next)
    setStep(4)
    setSubmitError(null)
    setSubmitMessage(null)
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setDraftLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function removeLine(key: string) {
    setDraftLines((prev) => prev.filter((line) => line.key !== key))
  }

  function addLine() {
    setDraftLines((prev) => [...prev, { key: `${Date.now()}-${Math.random()}`, itemId: null, quantity: 1, confidence: 0, detectedLabel: 'Ajout manuel' }])
  }

  function applyAssistantCommand() {
    const text = assistantInput.trim().toLowerCase()
    if (!text) return

    let nextMessage = 'Commande comprise, mais aucune modification appliquée.'

    const actionMatch = text.match(/\b(entree|entrée|entre|sortie|achat|vente)\b/)
    if (actionMatch) {
      const token = actionMatch[1]
      if (token === 'sortie') setAction('exit')
      else if (token === 'achat') setAction('purchase')
      else if (token === 'vente') setAction('sale')
      else setAction('entry')
      setStep(4)
      nextMessage = 'Action mise à jour depuis la commande IA.'
    }

    const quantityMatch = text.match(/(\d+)\s+([a-z0-9àâçéèêëîïôûùüÿñæœ' -]+)/i)
    if (quantityMatch) {
      const quantity = Math.max(0, Math.floor(Number(quantityMatch[1]) || 0))
      const label = quantityMatch[2].trim()

      setDraftLines((prev) => {
        const candidateIndex = prev.findIndex((line) => {
          const itemName = (line.itemId ? objectMap.get(line.itemId)?.name : line.detectedLabel) || ''
          return itemName.toLowerCase().includes(label) || label.includes(itemName.toLowerCase())
        })
        if (candidateIndex >= 0) {
          const copy = [...prev]
          copy[candidateIndex] = { ...copy[candidateIndex], quantity }
          return copy
        }

        const objectCandidate = localObjects.find((obj) => obj.name.toLowerCase().includes(label) || label.includes(obj.name.toLowerCase()))
        if (objectCandidate) {
          return [
            ...prev,
            {
              key: `${Date.now()}-${Math.random()}`,
              itemId: objectCandidate.id,
              quantity,
              confidence: 0.5,
              detectedLabel: `Ajout IA: ${label}`,
            },
          ]
        }
        return prev
      })
      nextMessage = `Quantité mise à jour (${quantity}) pour « ${label} » quand correspondance trouvée.`
    }

    if (text.includes('reanaly') || text.includes('réanaly')) {
      void runAnalysis()
      nextMessage = 'Réanalyse relancée.'
    }

    setAssistantMessage(nextMessage)
    setAssistantInput('')
  }

  async function validateTransaction() {
    if (!action) {
      setSubmitError('Choisis une action avant validation.')
      return
    }

    const lines: TxLineInput[] = draftLines
      .map((line) => {
        const item = line.itemId ? objectMap.get(line.itemId) : null
        if (!item || line.quantity <= 0) return null
        return {
          object: item,
          quantity: line.quantity,
          unit_price: item.price,
        }
      })
      .filter(Boolean) as TxLineInput[]

    if (lines.length === 0) {
      setSubmitError('Ajoute au moins un item valide pour continuer.')
      return
    }

    try {
      setSubmitting(true)
      setSubmitError(null)
      const txType = transactionTypeByAction[action]
      const result = await createTransaction({
        type: txType,
        lines,
        counterparty: counterparty.trim() || null,
        notes: [
          notes.trim(),
          `Scan IA (${actionLabels[action]})`,
        ]
          .filter(Boolean)
          .join(' · '),
      })

      setSubmitMessage(`Transaction enregistrée. Total estimé ${Number(result.total ?? 0).toFixed(2)} $.`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Erreur de validation.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Scan inventaire"
        subtitle="Analyse une capture et prépare automatiquement une transaction"
      />

      <Panel className="space-y-5">
        <div className="flex flex-wrap gap-2 text-xs">
          {[1, 2, 3, 4].map((s) => (
            <span
              key={s}
              className={`rounded-full border px-3 py-1 ${step >= s ? 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-white/55'}`}
            >
              Étape {s}
            </span>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-1">
            <h3 className="text-sm font-semibold text-white/90">1) Upload image</h3>
            <p className="text-xs text-white/55">Tu peux aussi faire Ctrl/Cmd + V pour coller une capture.</p>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const dropped = e.dataTransfer.files?.[0] ?? null
                onSelectFile(dropped)
              }}
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${isDragging ? 'border-cyan-300/45 bg-cyan-500/10' : 'border-white/15 bg-black/20'}`}
            >
              <Upload className="mx-auto h-8 w-8 text-white/70" />
              <p className="mt-2 text-sm text-white/80">Glisse une capture ici</p>
              <p className="text-xs text-white/45">JPG, PNG, WebP — 5 Mo max</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white/90 hover:bg-white/15"
              >
                Choisir une image
              </button>
              <input
                ref={inputRef}
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {previewUrl ? <img src={previewUrl} alt="Aperçu scan" className="max-h-64 w-full rounded-xl border border-white/10 object-contain" /> : null}
            <button
              type="button"
              disabled={!file || isAnalyzing}
              onClick={runAnalysis}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-50 hover:bg-cyan-500/25 disabled:opacity-40"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {isAnalyzing ? 'Analyse en cours…' : 'Analyser'}
            </button>
            {analysisError ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">{analysisError}</p> : null}
            <button
              type="button"
              onClick={() => setAssistantOpen((prev) => !prev)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs text-white/90 hover:bg-white/15"
            >
              Bouton IA (commandes rapides)
            </button>
            {assistantOpen ? (
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] text-white/55">Exemples: “entrée 50 pot”, “vente 12 bouteille”, “réanalyser”.</p>
                <div className="flex gap-2">
                  <input
                    value={assistantInput}
                    onChange={(e) => setAssistantInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyAssistantCommand()
                    }}
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white"
                    placeholder="Parle à l'IA…"
                  />
                  <button
                    type="button"
                    onClick={applyAssistantCommand}
                    className="rounded-lg border border-cyan-300/35 bg-cyan-500/20 px-2 py-1.5 text-xs text-cyan-50"
                  >
                    Appliquer
                  </button>
                </div>
                {assistantMessage ? <p className="text-[11px] text-cyan-100/90">{assistantMessage}</p> : null}
              </div>
            ) : null}
          </section>

          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-1">
            <h3 className="text-sm font-semibold text-white/90">2) Résultats IA</h3>
            <p className="text-xs text-white/60">Confiance globale : {(globalConfidence * 100).toFixed(0)}%</p>
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {isAnalyzing ? (
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyse multimodale en cours…
                </div>
              ) : detectedItems.length === 0 ? (
                <p className="text-sm text-white/55">Aucun item détecté pour le moment.</p>
              ) : (
                detectedItems.map((item, idx) => (
                  <div key={`${item.detected_label}-${idx}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-sm font-medium text-white/90">{item.matched_item_name || 'unknown'}</p>
                    <p className="text-xs text-white/60">Détecté: {item.detected_label}</p>
                    <p className="text-xs text-white/60">Qté estimée: {item.estimated_quantity}</p>
                    <p className="text-xs text-white/60">Confiance: {confidenceText(item.confidence)} ({(item.confidence * 100).toFixed(0)}%)</p>
                    {item.alternatives?.length ? (
                      <p className="mt-1 text-[11px] text-amber-200/90">
                        Alternatives: {item.alternatives.map((alt) => alt.item_name).join(', ')}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-1">
            <h3 className="text-sm font-semibold text-white/90">3) Action</h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(actionLabels) as ScanAction[]).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => pickAction(name)}
                  disabled={detectedItems.length === 0}
                  className={`rounded-2xl border px-3 py-5 text-sm font-semibold transition ${action === name ? 'border-cyan-300/40 bg-cyan-500/18 text-cyan-50' : 'border-white/15 bg-black/25 text-white/85 hover:bg-white/10'} disabled:opacity-40`}
                >
                  {actionLabels[name]}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/55">L’IA ne valide jamais seule: tu relis puis tu valides manuellement.</p>
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white/90">4) Brouillon transaction ({action ? actionLabels[action] : 'Action à choisir'})</h3>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white/90 hover:bg-white/15"
            >
              <Plus className="h-4 w-4" />
              Ajouter item
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-3 py-2 text-left">Source scan</th>
                  <th className="px-3 py-2 text-left">Correspondance item</th>
                  <th className="px-3 py-2 text-center">Quantité</th>
                  <th className="px-3 py-2 text-right">Confiance</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {draftLines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-white/60">Aucune ligne. Ajoute un item manuellement.</td>
                  </tr>
                ) : (
                  draftLines.map((line) => (
                    <tr key={line.key}>
                      <td className="px-3 py-2 text-white/80">{line.detectedLabel}</td>
                      <td className="px-3 py-2">
                        <select
                          value={line.itemId ?? ''}
                          onChange={(e) => updateLine(line.key, { itemId: e.target.value || null })}
                          className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-white"
                        >
                          <option value="">Choisir un item</option>
                          {localObjects.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                          className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-center text-white"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-white/70">{(line.confidence * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeLine(line.key)} className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/80 hover:bg-white/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-white/60">
              Interlocuteur (optionnel)
              <input
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
                placeholder="Nom du vendeur / acheteur / destinataire"
              />
            </label>
            <label className="text-xs text-white/60">
              Notes
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
                placeholder="Détails manuels avant validation"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/70">Total estimé: {totalEstimated.toFixed(2)} $</p>
            <button
              type="button"
              onClick={validateTransaction}
              disabled={!action || submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-50 hover:bg-emerald-500/25 disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? 'Validation…' : 'Valider la transaction'}
            </button>
          </div>

          {submitMessage ? <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{submitMessage}</p> : null}
          {submitError ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              <AlertTriangle className="h-4 w-4" />
              {submitError}
            </p>
          ) : null}
        </section>
      </Panel>
    </div>
  )
}
