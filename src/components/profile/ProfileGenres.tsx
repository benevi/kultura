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
    <section aria-labelledby="profile-genres-title">
      <h2 id="profile-genres-title" className="mb-4 font-display text-2xl text-text-primary">{t('topGenres')}</h2>
      <ul className="flex flex-wrap gap-2">
        {top8.map(({ genre, count }) => (
          <li
            key={genre}
            className="inline-flex items-center rounded-pill bg-surface-elevated px-3.5 py-2 text-xs font-semibold text-text-primary"
            title={t('genreCount', { count })}
          >
            {genre}
          </li>
        ))}
      </ul>
    </section>
  )
}
