'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'

export interface CreatedGroup {
  id: string
  name: string
  description: string | null
  cover_color: string
  memberRole: string
}

interface CreateGroupFormProps {
  /** Llamado con el grupo recién creado (memberRole = 'owner'). */
  onCreated: (group: CreatedGroup) => void
  /** Cerrar el form sin crear. */
  onCancel: () => void
}

/**
 * Form de creación de grupo. Reutilizado por FriendsClient (tab grupos, temporal)
 * y GroupsClient. POST /api/groups → notifica al padre vía onCreated.
 */
export function CreateGroupForm({ onCreated, onCancel }: CreateGroupFormProps) {
  const t = useTranslations('friends')
  const tG = useTranslations('groups')
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!groupName.trim()) return
    setCreating(true)
    setError(false)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim() || undefined,
          is_public: isPublic,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.group) {
        setError(true)
        return
      }
      onCreated({ ...data.group, memberRole: 'owner' })
      setGroupName('')
      setGroupDesc('')
      setIsPublic(true)
    } catch {
      setError(true)
    } finally {
      setCreating(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-default border border-surface-border rounded-xl p-4 flex flex-col gap-3"
    >
      <input
        type="text"
        value={groupName}
        onChange={e => setGroupName(e.target.value)}
        placeholder={t('groupNamePlaceholder')}
        maxLength={60}
        required
        className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-positive"
      />
      <textarea
        value={groupDesc}
        onChange={e => setGroupDesc(e.target.value)}
        placeholder={t('groupDescPlaceholder')}
        maxLength={200}
        rows={2}
        className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-accent-positive"
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">{tG('visibility')}</span>
        <div
          role="group"
          aria-label={tG('visibility')}
          className="flex gap-1 bg-surface-elevated border border-surface-border rounded-lg p-1"
        >
          <button
            type="button"
            aria-pressed={isPublic}
            onClick={() => setIsPublic(true)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
              isPublic
                ? 'bg-accent-positive text-on-accent-positive'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tG('public')}
          </button>
          <button
            type="button"
            aria-pressed={!isPublic}
            onClick={() => setIsPublic(false)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
              !isPublic
                ? 'bg-accent-positive text-on-accent-positive'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tG('private')}
          </button>
        </div>
        {!isPublic && (
          <p className="text-xs text-text-tertiary">{tG('privateHint')}</p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-accent-danger">{t('groupError')}</p>
      )}
      <div className="flex gap-2">
        <KButton
          type="submit"
          size="sm"
          variant="primary"
          loading={creating}
          disabled={creating}
        >
          {creating ? '...' : t('createGroup')}
        </KButton>
        <KButton
          type="button"
          size="sm"
          variant="secondary"
          onClick={onCancel}
        >
          ✕
        </KButton>
      </div>
    </form>
  )
}
