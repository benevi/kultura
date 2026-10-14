// ============================================================
// KULTURA — Colección pública (/u/{username}) unit tests
// Fija que la página pide `is_public = true` aunque la RLS ya lo imponga (el
// dueño puede leer sus privadas y no debe verlas aquí), que omite listas
// vacías y que ordena por formato.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Result = { data?: unknown; error?: unknown; count?: number }

/** Builder encadenable: registra cada filtro y resuelve con el resultado de su tabla. */
const calls: Array<{ table: string; method: string; args: unknown[] }> = []
const results: Record<string, Result[]> = {}

function builder(table: string) {
  const next = (): Result => (results[table]?.shift() ?? { data: null, error: null })
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'order']) {
    b[m] = (...args: unknown[]) => {
      calls.push({ table, method: m, args })
      return b
    }
  }
  b.maybeSingle = () => Promise.resolve(next())
  b.then = (resolve: (r: Result) => unknown) => resolve(next())
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: (table: string) => builder(table) }),
}))

const OWNER = { id: 'u1', username: 'ana', avatar_color: '#000', avatar_initials: 'AN', avatar_icon: null, bio: 'hola' }
const media = (id: string, title: string) => ({ id, title, poster: `https://x/${id}.jpg`, type: id.split('_')[0], year: 2020 })

beforeEach(() => {
  calls.length = 0
  for (const k of Object.keys(results)) delete results[k]
})

describe('getPublicCollection', () => {
  it('devuelve null si el usuario no existe', async () => {
    results.users = [{ data: null }]
    const { getPublicCollection } = await import('@/lib/social/public-collection')
    expect(await getPublicCollection('nadie')).toBeNull()
  })

  it('filtra por is_public = true de forma explícita', async () => {
    results.users = [{ data: OWNER }]
    results.lists = [{ data: [], error: null }]
    const { getPublicCollection } = await import('@/lib/social/public-collection')
    await getPublicCollection('ana')
    expect(calls).toContainEqual({ table: 'lists', method: 'eq', args: ['is_public', true] })
    expect(calls).toContainEqual({ table: 'lists', method: 'eq', args: ['owner_id', 'u1'] })
  })

  it('sin listas públicas devuelve el dueño con lista vacía (no null)', async () => {
    results.users = [{ data: OWNER }]
    results.lists = [{ data: [], error: null }]
    const { getPublicCollection } = await import('@/lib/social/public-collection')
    const res = await getPublicCollection('ana')
    expect(res?.owner.username).toBe('ana')
    expect(res?.lists).toEqual([])
  })

  it('omite listas públicas vacías y ordena por formato', async () => {
    results.users = [{ data: OWNER }]
    results.lists = [{
      data: [
        { id: 'l-game', name: 'Juegos', media_type: 'game' },
        { id: 'l-empty', name: 'Vacía', media_type: 'movie' },
        { id: 'l-movie', name: 'Pelis', media_type: 'movie' },
      ],
      error: null,
    }]
    results.list_items = [{
      data: [
        { list_id: 'l-game', media_id: 'game_1', media: media('game_1', 'Zelda') },
        { list_id: 'l-movie', media_id: 'movie_2', media: media('movie_2', 'Alien') },
      ],
      error: null,
    }]
    const { getPublicCollection } = await import('@/lib/social/public-collection')
    const res = await getPublicCollection('ana')
    expect(res?.lists.map((l) => l.id)).toEqual(['l-movie', 'l-game'])
    expect(res?.lists[0].items[0]).toMatchObject({ mediaId: 'movie_2', title: 'Alien', type: 'movie' })
  })
})

describe('getPublicList', () => {
  it('devuelve null si la lista no es pública o no es de ese usuario', async () => {
    results.users = [{ data: OWNER }]
    results.lists = [{ data: null }]
    const { getPublicList } = await import('@/lib/social/public-collection')
    expect(await getPublicList('ana', 'l-x')).toBeNull()
    expect(calls).toContainEqual({ table: 'lists', method: 'eq', args: ['is_public', true] })
    expect(calls).toContainEqual({ table: 'lists', method: 'eq', args: ['owner_id', 'u1'] })
  })
})

describe('sortByFormat', () => {
  it('respeta el orden de formatos y el de llegada dentro de cada uno', async () => {
    const { sortByFormat } = await import('@/lib/social/public-collection')
    const sorted = sortByFormat([
      { id: 'a', mediaType: 'book' as const },
      { id: 'b', mediaType: 'movie' as const },
      { id: 'c', mediaType: 'book' as const },
    ])
    expect(sorted.map((l) => l.id)).toEqual(['b', 'a', 'c'])
  })
})
