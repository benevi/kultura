'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { Spinner } from '@/components/ui/Spinner'
import { useToastContext } from '@/components/ui/ToastProvider'
import type { MediaItem } from '@/types/media'

interface RawList {
  id: string
  name: string
  media_type: string
  is_collaborative: boolean
}

interface AddToListButtonProps {
  item: MediaItem
}

export function AddToListButton({ item }: AddToListButtonProps) {
  const t = useTranslations('lists')
  const { show } = useToastContext()

  const [open, setOpen] = useState(false)
  const [lists, setLists] = useState<RawList[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [selectedListId, setSelectedListId] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingLists(true)
    setFetchError(false)
    fetch(`/api/lists?mediaType=${item.type}`)
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((data: { lists?: RawList[] }) => {
        setLists(data.lists ?? [])
        setSelectedListId('')
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoadingLists(false))
  }, [open, item.type])

  async function handleAdd() {
    if (!selectedListId || adding) return
    setAdding(true)
    try {
      const res = await fetch(`/api/lists/${selectedListId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: item.id,
          mediaCache: {
            externalId: item.externalId,
            type: item.type,
            title: item.title,
            poster: item.poster,
            backdrop: item.backdrop,
            year: item.year,
            synopsis: item.synopsis,
          },
        }),
      })

      const selectedName = lists.find((l) => l.id === selectedListId)?.name ?? ''

      if (res.status === 201) {
        show({ message: t('added', { name: selectedName }), type: 'success' })
        setOpen(false)
      } else if (res.status === 409) {
        show({ message: t('alreadyIn', { name: selectedName }), type: 'info' })
        setOpen(false)
      } else {
        show({ message: t('errorAdding'), type: 'error' })
      }
    } catch {
      show({ message: t('errorAdding'), type: 'error' })
    } finally {
      setAdding(false)
    }
  }

  const compatibleLists = lists

  return (
    <>
      <KButton variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t('addToList')}
      </KButton>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-backdrop-in">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm flex flex-col gap-4 p-5 animate-modal-in">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">{t('addToListTitle')}</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-text transition-colors text-xl leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {/* Body */}
            {loadingLists && (
              <div className="flex justify-center py-6">
                <Spinner size="md" />
              </div>
            )}

            {!loadingLists && fetchError && (
              <p className="text-sm text-accent-danger text-center py-4">{t('errorAdding')}</p>
            )}

            {!loadingLists && !fetchError && lists.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-sm text-text-secondary">{t('noListsAtAll')}</p>
                <Link
                  href="/lists"
                  className="text-sm text-accent-positive hover:underline font-medium"
                  onClick={() => setOpen(false)}
                >
                  {t('createListCta')}
                </Link>
              </div>
            )}

            {!loadingLists && !fetchError && lists.length > 0 && compatibleLists.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-sm text-text-secondary">{t('noCompatibleLists')}</p>
                <Link
                  href="/lists"
                  className="text-sm text-accent-positive hover:underline font-medium"
                  onClick={() => setOpen(false)}
                >
                  {t('createListCta')}
                </Link>
              </div>
            )}

            {!loadingLists && !fetchError && compatibleLists.length > 0 && (
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {compatibleLists.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-surface2 transition-colors"
                  >
                    <input
                      type="radio"
                      name="list-select"
                      value={l.id}
                      checked={selectedListId === l.id}
                      onChange={() => setSelectedListId(l.id)}
                      className="accent-accent"
                    />
                    <span className="text-sm font-medium text-text">{l.name}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Actions — Cancelar always visible */}
            <div className="flex gap-2 justify-end">
              <KButton variant="secondary" size="sm" onClick={() => setOpen(false)}>
                {t('cancel')}
              </KButton>
              {!loadingLists && !fetchError && compatibleLists.length > 0 && (
                <KButton
                  variant="primary"
                  size="sm"
                  loading={adding}
                  disabled={!selectedListId}
                  onClick={handleAdd}
                >
                  {t('addButton')}
                </KButton>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
