// ============================================================
// F-25 — Secciones de Inicio (Server Components):
//  - «Actividad reciente» (PRO-7): con un amigo que actualizó su biblioteca
//    hay ≥ 1 evento; sin amigos, la invitación a añadirlos.
//  - «Esta noche en tus plataformas» (PRO-6): sin migración no sale; sin
//    plataformas, la invitación a elegirlas; con ellas, solo lo disponible.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { fakeSupabase, type FakeClient } from './fake-supabase'

let client: FakeClient
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))
vi.mock('next-intl/server', () => ({
  getTranslations: async (ns?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${ns}.${key}${values ? JSON.stringify(values) : ''}`
    t.rich = (key: string, values: Record<string, unknown>) => `${ns}.${key}${JSON.stringify(
      Object.fromEntries(Object.entries(values).filter(([, v]) => typeof v !== 'function')),
    )}`
    return t
  },
}))
vi.mock('@/i18n/navigation', () => ({ Link: () => null }))
const providers = vi.hoisted(() => ({ movie: vi.fn(), tv: vi.fn() }))
vi.mock('@/lib/api/tmdb', () => ({ getMovieProviders: providers.movie, getTVProviders: providers.tv }))

import { FriendsActivity, TonightOnMyPlatforms } from '@/app/[locale]/(app)/home/sections'
import { TonightClient } from '@/app/[locale]/(app)/home/TonightClient'

function text(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join(' ')
  if (isValidElement(node)) return text((node as ReactElement<{ children?: ReactNode }>).props.children)
  return ''
}

const ME = 'me'

describe('FriendsActivity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('un amigo que actualizó su biblioteca → al menos un evento, con su nota', async () => {
    client = fakeSupabase({
      tables: {
        friendships: [{ data: [{ requester_id: ME, receiver_id: 'f1' }], error: null }],
        user_media: [{
          data: [{
            id: 'um1', user_id: 'f1', media_id: 'movie_550', status: 'completed', score: 5,
            created_at: '2026-10-01T00:00:00Z', updated_at: new Date().toISOString(),
            user: { id: 'f1', username: 'lucia', avatar_color: 'blue', avatar_initials: 'LU' },
            media: { id: 'movie_550', title: 'El club de la lucha', poster: null, type: 'movie' },
          }],
          error: null,
        }],
      },
    })
    const tree = await FriendsActivity({ userId: ME, locale: 'es' })
    const out = text(tree)
    expect(out).toContain('home.recentActivity')
    expect(out).toContain('home.activity.completed{"user":"lucia","title":"El club de la lucha"}')
    expect(out).toContain('home.activityScore{"score":5}')
  })

  it('sin amigos: la invitación a añadirlos (no "sin actividad")', async () => {
    client = fakeSupabase({ tables: { friendships: [{ data: [], error: null }] } })
    const out = text(await FriendsActivity({ userId: ME, locale: 'es' }))
    expect(out).toContain('home.noFriends')
    expect(out).not.toContain('home.noActivity')
  })

  it('con amigos pero sin movimientos: "sin actividad"', async () => {
    client = fakeSupabase({
      tables: {
        friendships: [{ data: [{ requester_id: 'f1', receiver_id: ME }], error: null }],
        user_media: [{ data: [], error: null }],
      },
    })
    expect(text(await FriendsActivity({ userId: ME, locale: 'es' }))).toContain('home.noActivity')
  })

  it('si falla la lectura, la sección no sale (Inicio sigue)', async () => {
    client = fakeSupabase({ tables: { friendships: [{ data: null, error: { message: 'x' } }] } })
    expect(await FriendsActivity({ userId: ME, locale: 'es' })).toBeNull()
  })
})

describe('TonightOnMyPlatforms', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sin la migración (columna inexistente) no sale nada', async () => {
    client = fakeSupabase({ tables: { users: [{ data: null, error: { code: '42703', message: 'no column' } }] } })
    expect(await TonightOnMyPlatforms({ userId: ME, locale: 'es' })).toBeNull()
  })

  it('sin plataformas marcadas: invitación a elegirlas, sin consultar TMDB', async () => {
    client = fakeSupabase({ tables: { users: [{ data: { streaming_services: [], streaming_region: null }, error: null }] } })
    const out = text(await TonightOnMyPlatforms({ userId: ME, locale: 'es' }))
    expect(out).toContain('platforms.tonightSetup')
    expect(providers.movie).not.toHaveBeenCalled()
  })

  it('con Netflix y Filmin: solo los pendientes disponibles en ellas', async () => {
    client = fakeSupabase({
      tables: {
        users: [{ data: { streaming_services: [8, 63], streaming_region: 'ES' }, error: null }],
        user_media: [{
          data: [
            { media_id: 'movie_1', media: { id: 'movie_1', title: 'En Netflix', poster: null, type: 'movie' } },
            { media_id: 'movie_2', media: { id: 'movie_2', title: 'En Disney+', poster: null, type: 'movie' } },
            { media_id: 'book_3', media: { id: 'book_3', title: 'Libro', poster: null, type: 'book' } },
          ],
          error: null,
        }],
      },
    })
    providers.movie.mockImplementation(async (id: number) => ({
      results: { ES: { flatrate: [id === 1 ? { provider_id: 8, provider_name: 'Netflix' } : { provider_id: 337, provider_name: 'Disney Plus' }] } },
    }))
    const el = (await TonightOnMyPlatforms({ userId: ME, locale: 'es' })) as ReactElement<{ picks: Array<{ title: string }>; platforms: string[] }>
    expect(el.type).toBe(TonightClient)
    expect(el.props.picks.map((p) => p.title)).toEqual(['En Netflix'])
    expect(el.props.platforms).toEqual(['Netflix', 'Filmin'])
    // Región guardada: ES.
    expect(providers.movie).toHaveBeenCalledWith(1, 'ES', 'es')
  })
})
