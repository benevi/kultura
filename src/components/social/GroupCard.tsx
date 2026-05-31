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
      className="bg-surface-default border border-surface-border rounded-xl p-4 hover:border-text-tertiary transition-colors flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <span
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: group.coverColor }}
        >
          {group.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="font-semibold text-sm text-text-primary truncate">{group.name}</span>
        {group.isMember && (
          <span className="ml-auto flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-accent-positive/15 text-accent-positive">
            {t('alreadyMember')}
          </span>
        )}
      </div>

      {group.description && (
        <p className="text-xs text-text-secondary line-clamp-2">{group.description}</p>
      )}

      <p className="text-xs text-text-tertiary mt-auto">
        {t('membersCount', { count: group.memberCount })}
      </p>
    </Link>
  )
}
