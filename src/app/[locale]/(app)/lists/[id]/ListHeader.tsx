'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import type { List, ListMember } from '@/types/list'
import { ListMetaLine } from './ListMetaLine'
import { ListDescription, type ListDescriptionProps } from './ListDescription'
import { ListVisibility } from './ListVisibility'
import { publicListPath } from './list-detail-utils'

interface ListHeaderProps {
  list: Pick<List, 'id' | 'name' | 'isCollaborative' | 'owner' | 'mediaType' | 'template'>
  members: ListMember[]
  itemCount: number
  isOwner: boolean
  canEdit: boolean
  description: Omit<ListDescriptionProps, 'isOwner'>
  isPublic: boolean
  onVisibilityChange: (value: string) => void
  onDeleteClick: () => void
}

/** Cabecera: nombre, datos, descripción, privacidad y acciones (borrar, añadir). */
export function ListHeader({
  list,
  members,
  itemCount,
  isOwner,
  canEdit,
  description,
  isPublic,
  onVisibilityChange,
  onDeleteClick,
}: ListHeaderProps) {
  const t = useTranslations('lists')

  return (
    <header className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        {/* El nombre de la lista ES el título de la pantalla, así que va
            al tipo del canvas (display 42px/700) — pero NO usa `PageHeading`:
            el artboard lo mete en una cabecera con avatares y chips debajo,
            no en la fila de título + acción. */}
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-text-primary leading-tight">
          {list.name}
        </h1>
        <ListMetaLine list={list} members={members} itemCount={itemCount} />
        <ListDescription {...description} isOwner={isOwner} />
        {isOwner && (
          <ListVisibility
            isPublic={isPublic}
            onChange={onVisibilityChange}
            publicPath={publicListPath(list)}
            listName={list.name}
          />
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {isOwner && (
          <KButton
            variant="secondary"
            size="sm"
            onClick={onDeleteClick}
            className="text-text-secondary hover:text-accent-danger"
          >
            {t('deleteList')}
          </KButton>
        )}
        {canEdit && (
          <KButton asChild>
            <Link href="/discover">
              {/* El "+" es decoración, igual que el emoji de `PageHeading`:
                  fuera del nombre accesible y sin repetirlo por idioma. */}
              <span aria-hidden="true" className="mr-1">+</span>
              {t('addItem')}
            </Link>
          </KButton>
        )}
      </div>
    </header>
  )
}
