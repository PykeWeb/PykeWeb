'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon, Upload, X } from 'lucide-react'

type Props = {
  label?: string
  onChange?: (file: File | null) => void
}

function isImageFile(file: File) {
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)
}

export function ImageDropzone({ label = 'Image', onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const previewUrl = useMemo(() => {
    if (!file) return null
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const commit = useCallback(
    (next: File | null) => {
      setFile(next)
      onChange?.(next)
    },
    [onChange]
  )

  const pick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const onFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      const f = files[0]
      if (!isImageFile(f)) return
      commit(f)
    },
    [commit]
  )

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile()
          if (f && isImageFile(f)) {
            e.preventDefault()
            commit(f)
            return
          }
        }
      }
    },
    [commit]
  )

  return (
    <div className="md:col-span-2">
      <label className="text-sm text-white/70">{label}</label>

      <div
        tabIndex={0}
        onPaste={onPaste}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          onFiles(e.dataTransfer.files)
        }}
        className={
          'mt-2 rounded-2xl border border-dashed bg-white/[0.03] p-4 outline-none transition ' +
          (dragOver ? 'border-white/35' : 'border-white/15') +
          ' focus:border-white/35'
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />

        {!previewUrl ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white/80">
                <ImageIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Ajoute une image (PNG/JPEG)</p>
                <p className="mt-1 text-xs text-white/60">
                  Glisse-dépose, clique pour upload, ou colle depuis le presse-papiers (Ctrl+V).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={pick}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium shadow-glow transition hover:bg-white/10"
            >
              <Upload className="h-4 w-4" />
              Choisir un fichier
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Aperçu"
                className="h-16 w-16 rounded-xl border border-white/10 object-cover"
              />
              <div>
                <p className="text-sm font-medium">{file?.name}</p>
                <p className="mt-1 text-xs text-white/60">
                  {(file?.size ? Math.round(file.size / 1024) : 0).toLocaleString('fr-FR')} Ko
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={pick}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium shadow-glow transition hover:bg-white/10"
              >
                Remplacer
              </button>
              <button
                type="button"
                onClick={() => commit(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
              >
                <X className="h-4 w-4" />
                Retirer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
