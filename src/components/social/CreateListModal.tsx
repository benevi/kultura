'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'

const MEDIA_TYPE_KEYS = ['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game'] as const
type MediaTypeKey = typeof MEDIA_TYPE_KEYS[number]

interface CreateListModalProps {
  onClose: () => void
}

export function CreateListModal({ onClose }: CreateListModalProps) {
  const t = useTranslations('lists')
  const tf = useTranslations('filters')
  const tc = useTranslations('common')
  const router = useRouter()

  const [name, setName] = useState('')
  const [mediaType, setMediaType] = useState<MediaTypeKey>('movie')
  const [isCollaborative, setIsCollaborative] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), mediaType, isCollaborative }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('errorCreate'))
        setLoading(false)
        return
      }
      router.push(`/lists/${data.list.id}`)
      onClose()
    } catch {
      setError(t('errorCreate'))
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-surface-elevated border border-surface-border rounded-xl w-full max-w-sm flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-text-primary">{t('createList')}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-xl leading-none">×</button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Nombre */}
          <div>
            <label className="text-xs text-text-secondary mb-1 block">{t('listName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi lista de películas..."
              className="w-full bg-surface-base border border-surface-border rounded-button px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-positive"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="text-xs text-text-secondary mb-1 block">{t('mediaType')}</label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MediaTypeKey)}
              className="w-full bg-surface-base border border-surface-border rounded-button px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-positive"
            >
              {MEDIA_TYPE_KEYS.map((key) => (
                <option key={key} value={key}>{tf(key)}</option>
              ))}
            </select>
          </div>

          {/* Colaborativa */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isCollaborative}
              onChange={(e) => setIsCollaborative(e.target.checked)}
              className="accent-accent-positive w-4 h-4"
            />
            <div>
              <p className="text-sm font-medium text-text-primary">{t('collaborative')}</p>
              <p className="text-xs text-text-tertiary">{t('collaborativeHint')}</p>
            </div>
          </label>
        </div>

        {error && <p className="text-xs text-accent-danger">{error}</p>}

        <div className="flex gap-2 justify-end">
          <KButton variant="secondary" size="sm" onClick={onClose}>{tc('cancel')}</KButton>
          <KButton
            variant="primary"
            size="sm"
            loading={loading}
            disabled={!name.trim()}
            onClick={handleCreate}
          >
            {t('create')}
          </KButton>
        </div>
      </div>
    </div>
  )
}
