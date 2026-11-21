'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

export interface GroupCardData {
  id: string
  name: string
  description: string | null
  coverColor: string
  memberCount: number
  isMember: boolean
}

interface GroupCardProps {
  group: GroupCardData
}

/**
 * Card reutilizable de grupo: avatar de color, nombre, descripción,
 * nº de miembros y badge "Ya eres miembro" cuando isMember.
 * Enlaza a /groups/{id}.
 */
export function GroupCard({ group }: GroupCardProps) {
  const t = useTranslations('groups')

  return (
    <Link
      href={`/groups/${group.id}`}
      className="rounded-bento border p-4 hover:brightness-110 transition-all flex flex-col gap-2 bg-surface-default border-surface-border"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="w-11 h-11 rounded-2xl rounded-bl-lg flex-shrink-0 flex items-center justify-center font-display font-extrabold text-sm text-on-accent-pink"
          style={{ background: group.coverColor }}
        >
          {group.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="font-bold text-sm truncate text-text-primary">{group.name}</span>
        {group.isMember && (
          <span
            className="ml-auto flex-shrink-0 text-xs font-extrabold px-2.5 py-1 rounded-full bg-accent-lime text-on-accent-lime"
          >
            {t('alreadyMember')}
          </span>
        )}
      </div>

      {group.description && (
        <p className="text-xs line-clamp-2 text-text-secondary">{group.description}</p>
      )}

      <p className="text-xs mt-auto text-text-tertiary">
        {t('membersCount', { count: group.memberCount })}
      </p>
    </Link>
  )
}
