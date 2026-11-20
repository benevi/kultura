import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import type { List, ListMember } from '@/types/list'

interface ListMetaLineProps {
  list: Pick<List, 'isCollaborative' | 'owner' | 'mediaType' | 'template'>
  members: ListMember[]
  itemCount: number
}

/** Bajo el título: avatares (si es colaborativa), formato, plantilla y nº de títulos. */
export function ListMetaLine({ list, members, itemCount }: ListMetaLineProps) {
  const t = useTranslations('lists')
  const tf = useTranslations('filters')
  const formatLabel = list.mediaType === 'mixed' ? t('mediaTypeMixed') : tf(list.mediaType)

  return (
    <div className="flex items-center gap-3 mt-3 flex-wrap">
      {list.isCollaborative && (
        <div className="flex items-center">
          {list.owner && (
            <Avatar
              initials={list.owner.avatarInitials}
              color={list.owner.avatarColor}
              size="sm"
              className="ring-2 ring-surface-base"
            />
          )}
          {members.map((m, i) => (
            m.user && (
              <Avatar
                key={m.userId}
                initials={m.user.avatarInitials}
                color={m.user.avatarColor}
                size="sm"
                className={i === 0 && !list.owner ? 'ring-2 ring-surface-base' : '-ml-[10px] ring-2 ring-surface-base'}
              />
            )
          ))}
        </div>
      )}
      <span className="text-meta text-text-tertiary">
        <span className="font-semibold text-text-secondary">{formatLabel}</span>
        {list.template ? ` · ${t(`template.${list.template}`)}` : ''}
        {' · '}
        {list.isCollaborative && (
          <span className="font-semibold text-text-primary">{t('collaborative')}</span>
        )}
        {list.isCollaborative && ' · '}
        {t('itemCount', { count: itemCount })}
      </span>
    </div>
  )
}
