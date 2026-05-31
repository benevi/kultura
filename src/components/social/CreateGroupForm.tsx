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
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!groupName.trim()) return
    setCreating(true)
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName.trim(), description: groupDesc.trim() || undefined }),
    })
    const data = await res.json()
    if (data.group) {
      onCreated({ ...data.group, memberRole: 'owner' })
      setGroupName('')
      setGroupDesc('')
    }
    setCreating(false)
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
