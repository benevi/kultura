// ============================================================
// KULTURA — ProfileGenres (Server Component)
// Chips de géneros favoritos del usuario. Top 8 máximo.
// ============================================================

import { getTranslations } from 'next-intl/server'

interface ProfileGenresProps {
  topGenres: { genre: string; count: number }[]
}

export async function ProfileGenres({ topGenres }: ProfileGenresProps) {
  if (topGenres.length === 0) return null

  const t = await getTranslations('profile')
  const top8 = topGenres.slice(0, 8)

  return (
    <section>
      <h2 className="font-display text-xl font-bold text-text-primary mb-4">{t('topGenres')}</h2>
      <div className="flex flex-wrap gap-2">
        {top8.map(({ genre, count }) => (
          <span
            key={genre}
            className="bg-surface-elevated border border-surface-border text-xs font-bold px-3.5 py-2 rounded-full text-text-primary"
            title={`${count} títulos`}
          >
            {genre}
          </span>
        ))}
      </div>
    </section>
  )
}
