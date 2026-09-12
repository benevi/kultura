'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { F0 } from '@/lib/design/f0-tokens'

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
      className="rounded-bento border p-4 hover:brightness-110 transition-all flex flex-col gap-2"
      style={{ background: F0.surface, borderColor: F0.stroke }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="w-11 h-11 rounded-[16px_16px_16px_4px] flex-shrink-0 flex items-center justify-center font-display font-extrabold text-sm"
          style={{ background: group.coverColor, color: F0.onPink }}
        >
          {group.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="font-bold text-sm truncate" style={{ color: F0.text }}>{group.name}</span>
        {group.isMember && (
          <span
            className="ml-auto flex-shrink-0 text-xs font-extrabold px-2.5 py-1 rounded-full"
            style={{ background: F0.lime, color: F0.onLime }}
          >
            {t('alreadyMember')}
          </span>
        )}
      </div>

      {group.description && (
        <p className="text-xs line-clamp-2" style={{ color: F0.textSecondary }}>{group.description}</p>
      )}

      <p className="text-xs mt-auto" style={{ color: F0.muted }}>
        {t('membersCount', { count: group.memberCount })}
      </p>
    </Link>
  )
}
