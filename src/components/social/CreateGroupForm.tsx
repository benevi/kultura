'use client'

import { useState } from 'react'
import { AvatarIconPicker } from '@/components/ui/AvatarIconPicker'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { KTextarea } from '@/components/ui/KTextarea'
import { createGroup, type GroupSummary } from '@/lib/groups/client'

interface CreateGroupFormProps {
  /** Llamado con el grupo recién creado (memberRole = 'owner'). */
  onCreated: (group: GroupSummary) => void
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
  // Mismos nombres de personaje que en el registro.
  const tAuth = useTranslations('auth')
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  // E-AVATAR-ICONS: icono del grupo, opcional (null → inicial del nombre).
  const [icon, setIcon] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!groupName.trim()) return
    setCreating(true)
    setError(false)
    try {
      const group = await createGroup({
        name: groupName.trim(),
        description: groupDesc.trim() || undefined,
        is_public: isPublic,
        icon,
      })
      onCreated(group)
      setGroupName('')
      setGroupDesc('')
      setIsPublic(true)
      setIcon(null)
    } catch {
      setError(true)
    } finally {
      setCreating(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-bento border p-4 flex flex-col gap-3 bg-surface-default border-surface-border"
    >
      <KInput
        type="text"
        value={groupName}
        onChange={e => setGroupName(e.target.value)}
        placeholder={t('groupNamePlaceholder')}
        // ACC-2: solo tenía placeholder; el nombre accesible es la etiqueta.
        aria-label={t('groupName')}
        maxLength={60}
        required
      />
      <KTextarea
        value={groupDesc}
        onChange={e => setGroupDesc(e.target.value)}
        placeholder={t('groupDescPlaceholder')}
        aria-label={t('groupDescription')}
        maxLength={200}
        rows={2}
        className="resize-none"
      />
      {/* Icono del grupo (E-AVATAR-ICONS) — opcional: sin elegir, el grupo se
          identifica por la inicial de su nombre, como hasta ahora. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-text-secondary">{tG('groupIcon')}</span>
        <AvatarIconPicker
          value={icon}
          onChange={setIcon}
          label={tG('groupIcon')}
          noneLabel={tG('groupIconNone')}
          iconLabel={(key) => tAuth(`characters.${key}`)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-text-secondary">{tG('visibility')}</span>
        <div
          role="group"
          aria-label={tG('visibility')}
          className="flex gap-1 rounded-2xl border-2 p-1 bg-surface-elevated border-surface-border"
        >
          <button
            type="button"
            aria-pressed={isPublic}
            onClick={() => setIsPublic(true)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${isPublic ? 'bg-accent-pink text-on-accent-pink' : 'text-text-tertiary'}`}
          >
            {tG('public')}
          </button>
          <button
            type="button"
            aria-pressed={!isPublic}
            onClick={() => setIsPublic(false)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${!isPublic ? 'bg-accent-pink text-on-accent-pink' : 'text-text-tertiary'}`}
          >
            {tG('private')}
          </button>
        </div>
        {!isPublic && (
          <p className="text-xs text-text-tertiary">{tG('privateHint')}</p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-accent-orange">{t('groupError')}</p>
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
