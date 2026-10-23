// F-17 (revisión del PR #39): favoritos vacíos del dueño, banner sin
// encabezado antes del h1, favoritos sin portada, nota localizada y retención.
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createTranslator } from 'next-intl'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'

vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
  getLocale: () => Promise.resolve('es'),
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/media/PosterImage', () => ({ PosterImage: () => null }))

import { FavoritesGrid, InviteBanner } from '@/components/collection/PublicCollection'
import { pickFavorites } from '@/lib/social/public-collection'

describe('FavoritesGrid del dueño', () => {
  it('sin ninguna nota: tarjeta compacta con CTA, no cuatro huecos 2:3', async () => {
    const { container } = render((await FavoritesGrid({ favorites: [], isOwner: true, priority: false }))!)
    expect(container.querySelectorAll('.aspect-\\[2\\/3\\]')).toHaveLength(0)
    expect(screen.getByText('favoritesEmpty')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'favoritesEmptyAction' })).toHaveAttribute('href', '/library')
  })
})

describe('InviteBanner', () => {
  it('no es un encabezado (va antes del h1 de la página)', async () => {
    render(await InviteBanner({ username: 'ana', friendsOnSignup: true, registerHref: '/login' }))
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'bannerTitle' })).toBeInTheDocument()
  })
})

describe('pickFavorites', () => {
  const fav = (id: string, score: number, poster: string | null = 'p') => ({ mediaId: id, title: id, poster, type: id.split('_')[0], score })

  it('con 4 o más con portada, ninguno sin portada entra (aunque sea de otro formato)', () => {
    const picked = pickFavorites([
      fav('movie_1', 5), fav('movie_2', 5), fav('tv_1', 4), fav('tv_2', 4), fav('anime_1', 5, null),
    ])
    expect(picked.every((p) => p.poster)).toBe(true)
    expect(picked.map((p) => p.mediaId)).toEqual(['movie_1', 'movie_2', 'tv_1', 'tv_2'])
  })

  it('con menos de 4 con portada, completa con los que no la tienen', () => {
    const picked = pickFavorites([fav('movie_1', 5), fav('anime_1', 4, null), fav('tv_1', 3)])
    expect(picked.map((p) => p.mediaId)).toEqual(['movie_1', 'anime_1', 'tv_1'])
  })
})

describe('favoriteScore localizado', () => {
  it('la cifra sale con el formato de cada idioma', () => {
    expect(createTranslator({ locale: 'es', messages: es }).raw('collection.favoriteScore')).toContain('{score, number}')
    expect(createTranslator({ locale: 'es', messages: es })('collection.favoriteScore', { score: 4.5 })).toBe('4,5 de 5')
    expect(createTranslator({ locale: 'en', messages: en })('collection.favoriteScore', { score: 4.5 })).toBe('4.5 out of 5')
  })
})

describe('retención de analytics_events', () => {
  it('la migración documenta 13 meses y trae la purga solo para service_role', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/20261115170001_analytics.sql'),
      'utf8',
    )
    expect(sql).toMatch(/RETENCIÓN: 13 meses/)
    expect(sql).toMatch(/create or replace function public\.purge_old_analytics_events\(p_keep interval default interval '13 months'\)/)
    expect(sql).toMatch(/revoke all on function public\.purge_old_analytics_events\(interval\) from public, anon, authenticated/)
    expect(sql).toMatch(/grant execute on function public\.purge_old_analytics_events\(interval\) to service_role/)
  })
})
