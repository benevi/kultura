'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
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
  const tc = useTranslations('common')
  const { show, showError } = useToastContext()

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
    fetch(`/api/lists`)
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
            genres: item.genres,
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
        showError(t('errorAdding'))
      }
    } catch {
      showError(t('errorAdding'))
    } finally {
      setAdding(false)
    }
  }

  const compatibleLists = lists.filter((l) => l.media_type === item.type)

  return (
    <>
      <KButton variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t('addToList')}
      </KButton>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        variant="sheet"
        title={t('addToListTitle')}
        closeLabel={tc('close')}
        dismissible={!adding}
      >
        {loadingLists && (
          <div className="flex justify-center py-6">
            <Spinner size="md" label={tc('loading')} />
          </div>
        )}

        {!loadingLists && fetchError && (
          <p role="alert" className="text-sm text-accent-danger text-center py-4">{t('errorAdding')}</p>
        )}

        {!loadingLists && !fetchError && lists.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-text-secondary">{t('noListsAtAll')}</p>
            <Link
              href="/lists"
              className="inline-flex min-h-11 items-center text-sm text-accent-positive hover:underline font-medium"
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
              className="inline-flex min-h-11 items-center text-sm text-accent-positive hover:underline font-medium"
              onClick={() => setOpen(false)}
            >
              {t('createListCta')}
            </Link>
          </div>
        )}

        {!loadingLists && !fetchError && compatibleLists.length > 0 && (
          // Radios nativos agrupados: el lector dice "Selecciona una lista,
          // grupo" y las flechas cambian de opción.
          <fieldset className="flex flex-col gap-1">
            <legend className="sr-only">{t('selectList')}</legend>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {compatibleLists.map((l) => (
                <label
                  key={l.id}
                  className="flex min-h-11 items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-surface-default transition-colors"
                >
                  <input
                    type="radio"
                    name="list-select"
                    value={l.id}
                    checked={selectedListId === l.id}
                    onChange={() => setSelectedListId(l.id)}
                    className="h-5 w-5 accent-accent-positive"
                  />
                  <span className="text-sm font-medium text-text-primary">{l.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Actions — Cancelar siempre visible */}
        <div className="flex gap-2 justify-end">
          <KButton variant="secondary" onClick={() => setOpen(false)} disabled={adding}>
            {t('cancel')}
          </KButton>
          {!loadingLists && !fetchError && compatibleLists.length > 0 && (
            <KButton
              variant="primary"
              loading={adding}
              disabled={!selectedListId}
              onClick={handleAdd}
            >
              {t('addButton')}
            </KButton>
          )}
        </div>
      </Modal>
    </>
  )
}
