// ============================================================
// Saneamiento 5.4 — Inicio lee el progreso de las columnas `progress_*`.
// Con PROGRESS_V2 un libro a la mitad guarda `progress_page` y deja el jsonb
// vacío: Inicio decía «Continuando» y «Sin empezar» a la vez.
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'

const { selects } = vi.hoisted(() => ({ selects: [] as string[] }))

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/i18n/navigation', () => ({ Link: () => null }))
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('es'),
  getTranslations: vi.fn().mockResolvedValue((k: string) => k),
}))
vi.mock('@/lib/claude/recommendations', () => ({
  MIN_LIBRARY_ITEMS: 3,
  readTodayAiRecommendations: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/recommendations/starter', () => ({ getStarterItems: vi.fn() }))
vi.mock('@/components/home/AiRecommendations', () => ({ AiRecommendations: () => null }))
vi.mock('@/components/home/PopularInCircle', () => ({ PopularInCircle: () => null }))
vi.mock('@/components/home/GenreNews', () => ({ GenreNews: () => null }))

function HeroStub() {
  return null
}
function ContinueRowStub() {
  return null
}
vi.mock('@/components/home/HeroSection', () => ({ HeroSection: HeroStub }))
vi.mock('@/components/home/ContinueRow', () => ({ ContinueRow: ContinueRowStub }))

const NO_PROGRESS = {
  progress_season: null, progress_episode: null, progress_chapter: null, progress_volume: null,
  progress_page: null, progress_percent: null, progress_hours: null, progress_total: null,
}
const HERO_ROW = {
  media_id: 'book_1',
  ...NO_PROGRESS,
  progress_page: 120,
  progress_total: 300,
  media: { id: 'book_1', title: 'Libro', poster: null, year: 2020, type: 'book', synopsis: null },
}
const RECENT_ROWS = [
  HERO_ROW,
  {
    media_id: 'manga_2',
    status: 'in_progress',
    ...NO_PROGRESS,
    progress_chapter: 42,
    media: { id: 'manga_2', title: 'Manga', poster: null, type: 'manga' },
  },
]

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'a@b.c' } } }) },
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'user-1' } }) }) }) }
      }
      return {
        select: (cols: string, opts?: { head?: boolean }) => {
          selects.push(cols)
          const chain: Record<string, unknown> = {}
          chain.eq = () => chain
          chain.in = () => chain
          chain.order = () => chain
          chain.limit = () =>
            opts?.head
              ? chain
              : Object.assign(Promise.resolve({ data: RECENT_ROWS }), { maybeSingle: async () => ({ data: HERO_ROW }) })
          chain.maybeSingle = async () => ({ data: null })
          chain.or = async () => ({ count: 5, error: null })
          return chain
        },
      }
    },
  }),
}))

function findByType(node: ReactNode, type: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type)
      if (found) return found
    }
    return null
  }
  const el = node as ReactElement<{ children?: ReactNode }>
  if (el.type === type) return el.props as Record<string, unknown>
  return findByType(el.props?.children, type)
}

describe('Inicio — progreso de las columnas progress_* (saneamiento 5.4)', () => {
  it('pide las columnas y pasa el progreso al hero y a «Continuar»', async () => {
    const { default: HomePage } = await import('@/app/[locale]/(app)/home/page')
    const tree = await HomePage()

    expect(selects.filter((c) => c.includes('progress_page'))).toHaveLength(2)

    expect(selects.some((c) => c.includes('episode_progress'))).toBe(false)

    const hero = findByType(tree, HeroStub) as { item: { progress: unknown } }
    expect(hero.item.progress).toEqual({ page: 120, total: 300 })

    const row = findByType(tree, ContinueRowStub) as { items: { mediaId: string; progress: unknown }[] }
    expect(row.items).toEqual([expect.objectContaining({ mediaId: 'manga_2', progress: { chapter: 42 } })])
  })
})
