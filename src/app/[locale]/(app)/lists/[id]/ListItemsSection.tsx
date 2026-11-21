import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { IconLists } from '@/components/icons'
import type { ListItem } from '@/types/list'
import { ReorderableItems } from './ReorderableItems'
import { ListItemCard } from './ListItemCard'

interface ListItemsSectionProps {
  listId: string
  items: ListItem[]
  onItemsChange: (items: ListItem[]) => void
  ranked: boolean
  canEdit: boolean
  /** Quien puede editar también puede ordenar. */
  canOrder: boolean
  reordering: boolean
  onToggleReordering: () => void
  removingItem: string | null
  onRemoveItem: (itemId: string) => void
}

/** Títulos de la lista: rejilla, estado vacío o modo de ordenar. */
export function ListItemsSection({
  listId,
  items,
  onItemsChange,
  ranked,
  canEdit,
  canOrder,
  reordering,
  onToggleReordering,
  removingItem,
  onRemoveItem,
}: ListItemsSectionProps) {
  const t = useTranslations('lists')

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-text-primary">
          {t('itemsTitle')}
          <span className="ml-2 text-sm font-body font-medium text-text-secondary">{items.length}</span>
        </h2>
        {canOrder && items.length > 0 && (
          <KButton
            variant={reordering ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={reordering}
            onClick={onToggleReordering}
          >
            {reordering ? t('reorderDone') : t('reorder')}
          </KButton>
        )}
      </div>
      {reordering && canOrder && items.length > 0 ? (
        <ReorderableItems listId={listId} items={items} onItemsChange={onItemsChange} ranked={ranked} />
      ) : items.length === 0 ? (
        <div className="bg-surface-default rounded-bento p-10 text-center flex flex-col items-center gap-3">
          <IconLists aria-hidden="true" className="h-8 w-8 text-text-tertiary" />
          <p className="text-text-primary text-sm font-medium">{t('noItems')}</p>
          <p className="text-text-secondary text-sm">{t('noItemsHint')}</p>
          <KButton asChild size="sm" className="mt-1">
            <Link href="/discover">{t('noItemsDiscover')}</Link>
          </KButton>
        </div>
      ) : (
        // El orden manual es el orden de lectura (lista numerada); el número
        // solo se PINTA en un «Ranking personal».
        <ol className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-5" aria-label={t('itemsTitle')}>
          {items.map((item, index) => (
            <ListItemCard
              key={item.id}
              listId={listId}
              item={item}
              index={index}
              ranked={ranked}
              canEdit={canEdit}
              removing={removingItem === item.id}
              onRemove={onRemoveItem}
            />
          ))}
        </ol>
      )}
    </section>
  )
}
