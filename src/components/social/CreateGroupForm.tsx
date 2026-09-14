'use client'

import { useState } from 'react'
import { AvatarIconPicker } from '@/components/ui/AvatarIconPicker'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { F0 } from '@/lib/design/f0-tokens'

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
  'w-full rounded-2xl border-2 px-3 py-2.5 text-sm placeholder:opacity-60 resize-none focus:outline-none focus:ring-2 focus-visible:ring-[oklch(68%_0.24_350)]'
const FIELD_STYLE = { background: F0.surface2, borderColor: F0.stroke, color: F0.text }

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
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim() || undefined,
          is_public: isPublic,
          icon,
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
      className="rounded-bento border p-4 flex flex-col gap-3"
      style={{ background: F0.surface, borderColor: F0.stroke }}
    >
      <input
        type="text"
        value={groupName}
        onChange={e => setGroupName(e.target.value)}
        placeholder={t('groupNamePlaceholder')}
        maxLength={60}
        required
        className={FIELD_CLASS}
        style={FIELD_STYLE}
      />
      <textarea
        value={groupDesc}
        onChange={e => setGroupDesc(e.target.value)}
        placeholder={t('groupDescPlaceholder')}
        maxLength={200}
        rows={2}
        className={FIELD_CLASS}
        style={FIELD_STYLE}
      />
      {/* Icono del grupo (E-AVATAR-ICONS) — opcional: sin elegir, el grupo se
          identifica por la inicial de su nombre, como hasta ahora. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold" style={{ color: F0.textSecondary }}>{tG('groupIcon')}</span>
        <AvatarIconPicker
          value={icon}
          onChange={setIcon}
          label={tG('groupIcon')}
          noneLabel={tG('groupIconNone')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold" style={{ color: F0.textSecondary }}>{tG('visibility')}</span>
        <div
          role="group"
          aria-label={tG('visibility')}
          className="flex gap-1 rounded-2xl border-2 p-1"
          style={{ background: F0.surface2, borderColor: F0.stroke }}
        >
          <button
            type="button"
            aria-pressed={isPublic}
            onClick={() => setIsPublic(true)}
            className="flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors"
            style={isPublic ? { background: F0.pink, color: F0.onPink } : { color: F0.muted }}
          >
            {tG('public')}
          </button>
          <button
            type="button"
            aria-pressed={!isPublic}
            onClick={() => setIsPublic(false)}
            className="flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors"
            style={!isPublic ? { background: F0.pink, color: F0.onPink } : { color: F0.muted }}
          >
            {tG('private')}
          </button>
        </div>
        {!isPublic && (
          <p className="text-xs" style={{ color: F0.muted }}>{tG('privateHint')}</p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs" style={{ color: F0.orange }}>{t('groupError')}</p>
      )}
      <div className="flex gap-2">
        <KButton
          type="submit"
          size="sm"
          variant="primary"
          loading={creating}
          disabled={creating}
          className="rounded-full font-extrabold"
          style={{ background: F0.pink, color: F0.onPink }}
        >
          {creating ? '...' : t('createGroup')}
        </KButton>
        <KButton
          type="button"
          size="sm"
          variant="secondary"
          onClick={onCancel}
          className="rounded-full font-bold border-2"
          style={{ borderColor: F0.stroke, color: F0.textSecondary }}
        >
          ✕
        </KButton>
      </div>
    </form>
  )
}
