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

const FIELD_CLASS =
  'w-full rounded-[14px] border-2 border-transparent bg-surface-elevated px-[18px] py-[13px] text-[15px] text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:border-accent-pink'

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
      className="rounded-[20px] bg-surface-default p-6 flex flex-col gap-3.5"
    >
      <input
        type="text"
        value={groupName}
        onChange={e => setGroupName(e.target.value)}
        placeholder={t('groupNamePlaceholder')}
        maxLength={60}
        required
        className={FIELD_CLASS}
      />
      <textarea
        value={groupDesc}
        onChange={e => setGroupDesc(e.target.value)}
        placeholder={t('groupDescPlaceholder')}
        maxLength={200}
        rows={2}
        className={FIELD_CLASS}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{tG('visibility')}</span>
        <div
          role="group"
          aria-label={tG('visibility')}
          className="flex gap-1 rounded-full bg-surface-elevated p-1"
        >
          <button
            type="button"
            aria-pressed={isPublic}
            onClick={() => setIsPublic(true)}
            className="flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors"
            style={isPublic ? { background: 'var(--accent-pink)', color: 'var(--on-accent-pink)' } : { color: 'var(--text-tertiary)' }}
          >
            {tG('public')}
          </button>
          <button
            type="button"
            aria-pressed={!isPublic}
            onClick={() => setIsPublic(false)}
            className="flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors"
            style={!isPublic ? { background: 'var(--accent-pink)', color: 'var(--on-accent-pink)' } : { color: 'var(--text-tertiary)' }}
          >
            {tG('private')}
          </button>
        </div>
        {!isPublic && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{tG('privateHint')}</p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--accent-orange)' }}>{t('groupError')}</p>
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
