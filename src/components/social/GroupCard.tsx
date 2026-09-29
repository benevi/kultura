'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { cardGradient, hueFromSeed } from '@/lib/design/gradient'

export interface GroupCardData {
  id: string
  name: string
  description: string | null
  coverColor: string
  /** Ausente = no se muestra el chip de miembros (p. ej. "Mis grupos"). */
  memberCount?: number
  isMember?: boolean
}

interface GroupCardProps {
  group: GroupCardData
}

/**
 * Card de grupo F0 (mockup Groups): bloque con gradiente de dos paradas del
 * mismo matiz (derivado del id), nombre en display 800, inicial en círculo
 * arriba a la derecha y chip translúcido de miembros abajo. Enlaza a
 * /groups/{id}.
 */
export function GroupCard({ group }: GroupCardProps) {
  const t = useTranslations('groups')

  return (
    <Link
      href={`/groups/${group.id}`}
      className="rounded-[20px] p-6 min-h-[180px] flex flex-col justify-between gap-4 hover:brightness-110 transition-all"
      style={{ background: cardGradient(hueFromSeed(group.id)) }}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-extrabold text-text-primary line-clamp-2">
            {group.name}
          </h3>
          {group.description && (
            <p className="text-xs mt-1.5 line-clamp-2 text-text-secondary">{group.description}</p>
          )}
        </div>
        <span
          aria-hidden="true"
          className="w-[34px] h-[34px] rounded-full flex-shrink-0 flex items-center justify-center font-extrabold text-[11px] border-2 border-surface-base text-on-accent-pink"
          style={{ background: group.coverColor }}
        >
          {group.name.slice(0, 1).toUpperCase()}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {group.memberCount !== undefined && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-4 py-[7px] text-xs font-bold text-text-primary">
            <span aria-hidden="true">👥</span>
            {t('membersCount', { count: group.memberCount })}
          </span>
        )}
        {group.isMember && (
          <span className="inline-flex items-center rounded-full bg-accent-lime text-on-accent-lime px-3 py-[7px] text-xs font-extrabold">
            {t('alreadyMember')}
          </span>
        )}
      </div>
    </Link>
  )
}
