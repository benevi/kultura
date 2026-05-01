'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import type { AiRec } from '@/lib/claude/recommendations'

type Status = 'loading' | 'done' | 'empty' | 'error' | 'rate_limited'

const TYPE_LABELS: Record<string, string> = {
  movie: 'Película',
  tv: 'Serie',
  anime: 'Anime',
  book: 'Libro',
  comic: 'Cómic',
  manga: 'Manga',
  game: 'Juego',
}

const SKELETON_KEYS = [0, 1, 2, 3, 4, 5]

export function AiRecommendations() {
  const [recs, setRecs] = useState<AiRec[]>([])
  const [status, setStatus] = useState<Status>('loading')

  const fetchRecs = useCallback(() => {
    setStatus('loading')
    const controller = new AbortController()

    fetch('/api/ai-recommendations', { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 429) { setStatus('rate_limited'); return }
        if (!r.ok) { setStatus('error'); return }
        const data: { recommendations?: AiRec[] } = await r.json()
        const list = data.recommendations ?? []
        setRecs(list)
        setStatus(list.length === 0 ? 'empty' : 'done')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setStatus('error')
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const cleanup = fetchRecs()
    return cleanup
  }, [fetchRecs])

  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="font-display text-xl">Para ti</h2>
        <span className="text-xs text-muted">Claude IA</span>
      </div>

      {status === 'loading' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SKELETON_KEYS.map((i) => (
            <div key={i} className="animate-pulse bg-surface2 rounded-lg aspect-[2/3]" />
          ))}
        </div>
      )}

      {status === 'empty' && (
        <p className="text-sm text-muted">
          Añade al menos 3 títulos completados o puntuados para recibir recomendaciones.
        </p>
      )}

      {(status === 'rate_limited' || status === 'error') && (
        <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {status === 'rate_limited'
              ? 'Demasiadas solicitudes. Espera un momento.'
              : 'No se pudieron cargar las recomendaciones.'}
          </p>
          <button
            onClick={fetchRecs}
            className="text-xs font-medium text-accent hover:underline flex-shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {status === 'done' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {recs.map((rec, i) => (
            <Link
              key={i}
              href={`/search?q=${rec.searchQuery}`}
              className="bg-surface2 border border-border rounded-lg overflow-hidden hover:border-accent/50 transition-colors relative group"
            >
              <div className="aspect-[2/3] bg-surface3 flex items-center justify-center relative">
                <span className="text-3xl font-bold text-surface3 select-none">
                  {rec.title.slice(0, 2).toUpperCase()}
                </span>
                <span className="absolute top-1.5 right-1.5 text-[10px] bg-bg/80 px-1.5 py-0.5 rounded text-muted-light">
                  {TYPE_LABELS[rec.type] ?? rec.type}
                </span>
              </div>
              <div className="p-2">
                <p className="text-sm font-medium text-text line-clamp-2 leading-tight">
                  {rec.title}
                </p>
                {rec.year && (
                  <p className="text-xs text-muted mt-0.5">{rec.year}</p>
                )}
                <p className="text-xs text-muted line-clamp-2 mt-1 leading-relaxed">
                  {rec.reason}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
