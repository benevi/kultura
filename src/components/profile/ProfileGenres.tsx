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
      <h2 className="font-display text-xl text-text mb-4">{t('topGenres')}</h2>
      <div className="flex flex-wrap gap-2">
        {top8.map(({ genre, count }) => (
          <span
            key={genre}
            className="bg-surface2 text-xs px-3 py-1.5 rounded-full text-muted"
            title={`${count} títulos`}
          >
            {genre}
          </span>
        ))}
      </div>
    </section>
  )
}
