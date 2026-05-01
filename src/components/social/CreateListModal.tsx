'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'

const MEDIA_TYPES = [
  { value: 'movie', label: 'Películas' },
  { value: 'tv', label: 'Series' },
  { value: 'anime', label: 'Anime' },
  { value: 'book', label: 'Libros' },
  { value: 'comic', label: 'Cómics' },
  { value: 'manga', label: 'Manga' },
  { value: 'game', label: 'Videojuegos' },
]

interface CreateListModalProps {
  onClose: () => void
}

export function CreateListModal({ onClose }: CreateListModalProps) {
  const t = useTranslations('lists')
  const router = useRouter()

  const [name, setName] = useState('')
  const [mediaType, setMediaType] = useState('movie')
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
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">{t('createList')}</h2>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none">×</button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Nombre */}
          <div>
            <label className="text-xs text-muted mb-1 block">{t('listName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi lista de películas..."
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="text-xs text-muted mb-1 block">{t('mediaType')}</label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {MEDIA_TYPES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Colaborativa */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isCollaborative}
              onChange={(e) => setIsCollaborative(e.target.checked)}
              className="accent-accent w-4 h-4"
            />
            <div>
              <p className="text-sm font-medium text-text">{t('collaborative')}</p>
              <p className="text-xs text-muted">{t('collaborativeHint')}</p>
            </div>
          </label>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            disabled={!name.trim()}
            onClick={handleCreate}
          >
            {t('create')}
          </Button>
        </div>
      </div>
    </div>
  )
}
