// ============================================================
// KULTURA — ProfileStats (Server Component)
// Grid de stat cards por tipo de contenido.
// ============================================================

import { getTranslations } from 'next-intl/server'
import type { TypeStats } from '@/lib/library/stats'

interface ProfileStatsProps {
  byType: TypeStats[]
  totalItems: number
}

const TYPE_ICONS: Record<string, string> = {
  movie: '🎬',
  tv: '📺',
  anime: '⛩️',
  book: '📚',
  comic: '🦸',
  manga: '🖊️',
  game: '🎮',
}

export async function ProfileStats({ byType, totalItems }: ProfileStatsProps) {
  const t = await getTranslations('profile')
  const tMedia = await getTranslations('media')

  if (byType.length === 0 || totalItems === 0) {
    return <p className="text-muted text-sm">{t('noStats')}</p>
  }

  return (
    <section>
      <h2 className="font-display text-xl text-text mb-4">{t('stats')}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {byType.filter(s => s.total > 0).map(s => (
          <div
            key={s.type}
            className="bg-surface2 rounded-lg p-4 text-center"
          >
            <span className="text-2xl" aria-hidden>{TYPE_ICONS[s.type] ?? '✦'}</span>
            <p className="text-2xl font-bold text-text leading-none mt-2">{s.total}</p>
            <p className="text-xs text-muted mt-1">
              {tMedia(s.type as Parameters<typeof tMedia>[0])}
            </p>
            <p className="text-xs text-muted/70 mt-0.5">
              {s.completed} {t('completed')}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
