'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { KButton } from '@/components/ui/KButton'

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
          className="w-full bg-surface-elevated border border-surface-border rounded-button px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-accent-positive"
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
            onClick={() => { setEditing(false); setDraft(currentBio) }}
          >
            {t('cancelBio')}
          </KButton>
          <span className="ml-auto text-xs text-text-tertiary">{draft.length}/200</span>
        </div>
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
