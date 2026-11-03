'use client'

// ============================================================
// KULTURA — Bio del perfil (con sesión), editable por su dueño.
// La bio es contenido de la persona: respeta sus saltos de línea y parte
// las palabras largas (una URL no se sale de la pantalla). El botón de
// editar está SIEMPRE a la vista (antes solo aparecía al pasar el ratón:
// con teclado o en el móvil no existía) y lleva el foco del sistema.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'

/** Mismo tope que valida `PATCH /api/settings`. */
const BIO_MAX_LENGTH = 200

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

/** Botón de texto: 44 px de alto en pantallas táctiles, foco visible. */
const TEXT_BUTTON = `inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-semibold text-text-secondary underline-offset-4 transition-colors duration-fast hover:text-text-primary hover:underline pointer-coarse:min-h-11 ${FOCUS}`

interface Props {
  bio: string | null
  isOwner: boolean
  /** Se mantiene por compatibilidad con `ProfileHeader`; la API usa la sesión. */
  userId: string
}

export function ProfileBio({ bio, isOwner }: Props) {
  const t = useTranslations('profile')
  const [currentBio, setCurrentBio] = useState(bio ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(bio ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const boxRef = useRef<HTMLTextAreaElement>(null)

  // Al abrir el editor, el foco va al campo solo con puntero fino: en el
  // móvil abriría el teclado tapando media pantalla (WIG).
  useEffect(() => {
    if (!editing) return
    const fine = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches
    if (fine) boxRef.current?.focus()
  }, [editing])

  // La bio pasa por la API (validación, límite de peticiones y bloqueo de la
  // demo) en vez de escribirse con el cliente de Supabase desde el navegador.
  const handleSave = async () => {
    setSaving(true)
    setSaveError(false)
    const next = draft.trim()
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: next || null }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setCurrentBio(next)
      setEditing(false)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex max-w-prose flex-col gap-2">
        <textarea
          ref={boxRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={BIO_MAX_LENGTH}
          rows={3}
          name="bio"
          placeholder={t('bioPlaceholder')}
          aria-label={t('bio')}
          aria-invalid={saveError || undefined}
          aria-describedby={saveError ? 'bio-error' : undefined}
          className={`w-full resize-none rounded-button border border-field-border bg-surface-elevated px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary md:text-body ${FOCUS}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <KButton size="sm" variant="primary" onClick={handleSave} loading={saving}>
            {t('saveBio')}
          </KButton>
          <KButton
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(false)
              setDraft(currentBio)
              setSaveError(false)
            }}
          >
            {t('cancelBio')}
          </KButton>
          <span className="ml-auto text-xs tabular-nums text-text-tertiary">
            {draft.length}/{BIO_MAX_LENGTH}
          </span>
        </div>
        {saveError ? (
          <p id="bio-error" role="alert" className="text-meta text-accent-danger">
            {t('bioSaveError')}
          </p>
        ) : null}
      </div>
    )
  }

  if (currentBio) {
    return (
      <div className="flex max-w-prose flex-col items-start gap-1">
        <p className="whitespace-pre-line break-words text-body leading-relaxed text-text-secondary [overflow-wrap:anywhere]">
          {currentBio}
        </p>
        {isOwner ? (
          <button type="button" onClick={() => setEditing(true)} className={TEXT_BUTTON}>
            {t('editBio')}
          </button>
        ) : null}
      </div>
    )
  }

  if (isOwner) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={TEXT_BUTTON}>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M8 3v10M3 8h10" />
        </svg>
        {t('addBio')}
      </button>
    )
  }

  return null
}
