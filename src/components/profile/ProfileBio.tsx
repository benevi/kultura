'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'

/** Mismo tope que valida `PATCH /api/settings`. */
const BIO_MAX_LENGTH = 200

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
      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={BIO_MAX_LENGTH}
          rows={3}
          placeholder={t('bioPlaceholder')}
          aria-label={t('bio')}
          aria-invalid={saveError || undefined}
          className="w-full bg-surface-elevated border border-surface-border rounded-button px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-accent-pink"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <KButton
            size="sm"
            variant="primary"
            onClick={handleSave}
            loading={saving}
          >
            {t('saveBio')}
          </KButton>
          <KButton
            size="sm"
            variant="secondary"
            onClick={() => { setEditing(false); setDraft(currentBio); setSaveError(false) }}
          >
            {t('cancelBio')}
          </KButton>
          <span className="ml-auto text-xs text-text-tertiary">{draft.length}/{BIO_MAX_LENGTH}</span>
        </div>
        {saveError ? (
          <p role="alert" className="text-xs text-accent-danger">{t('bioSaveError')}</p>
        ) : null}
      </div>
    )
  }

  if (currentBio) {
    return (
      <div className="flex items-start gap-2 group">
        <p className="text-sm text-text-secondary leading-relaxed flex-1">{currentBio}</p>
        {isOwner && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-text-tertiary hover:text-accent-positive flex-shrink-0 mt-0.5"
          >
            {t('editBio')}
          </button>
        )}
      </div>
    )
  }

  if (isOwner) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-text-tertiary hover:text-accent-positive transition-colors"
      >
        + {t('editBio')}
      </button>
    )
  }

  return null
}
