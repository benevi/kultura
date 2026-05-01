'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

interface Props {
  bio: string | null
  isOwner: boolean
  userId: string
}

export function ProfileBio({ bio, isOwner, userId }: Props) {
  const t = useTranslations('profile')
  const [currentBio, setCurrentBio] = useState(bio ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(bio ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('users').update({ bio: draft.trim() || null }).eq('id', userId)
    setCurrentBio(draft.trim())
    setEditing(false)
    setSaving(false)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder={t('bioPlaceholder')}
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? '...' : t('saveBio')}
          </button>
          <button
            onClick={() => { setEditing(false); setDraft(currentBio) }}
            className="px-3 py-1.5 text-xs font-medium text-muted hover:text-text transition-colors"
          >
            {t('cancelBio')}
          </button>
          <span className="ml-auto text-xs text-muted">{draft.length}/200</span>
        </div>
      </div>
    )
  }

  if (currentBio) {
    return (
      <div className="flex items-start gap-2 group">
        <p className="text-sm text-muted leading-relaxed flex-1">{currentBio}</p>
        {isOwner && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted hover:text-accent flex-shrink-0 mt-0.5"
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
        className="text-sm text-muted hover:text-accent transition-colors"
      >
        + {t('editBio')}
      </button>
    )
  }

  return null
}
