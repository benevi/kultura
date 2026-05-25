'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ListCard } from '@/components/social/ListCard'
import { CreateListModal } from '@/components/social/CreateListModal'
import { KButton } from '@/components/ui/KButton'
import type { List } from '@/types/list'

interface Props {
  lists: List[]
}

export function ListsClient({ lists: initialLists }: Props) {
  const t = useTranslations('lists')
  const [lists] = useState<List[]>(initialLists)
  const [showModal, setShowModal] = useState(false)

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl text-text-primary">{t('title')}</h1>
        <KButton variant="primary" size="sm" onClick={() => setShowModal(true)}>
          {t('newList')}
        </KButton>
      </div>

      {lists.length === 0 ? (
        <div className="bg-surface-default border border-surface-border rounded-xl p-10 text-center flex flex-col gap-2">
          <p className="font-medium text-text-primary">{t('noLists')}</p>
          <p className="text-sm text-text-tertiary">{t('noListsHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      )}

      {showModal && <CreateListModal onClose={() => setShowModal(false)} />}
    </main>
  )
}
