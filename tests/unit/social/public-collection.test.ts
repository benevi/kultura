// ============================================================
// KULTURA — Perfil público (/u/{username}) unit tests
// Fija que la página pide `is_public = true` aunque la RLS ya lo imponga (el
// dueño puede leer sus privadas y no debe verlas aquí), que omite listas
// vacías y ordena por formato, que todo sale de UNA consulta anidada (REN-6)
// con vuelta a las tres de antes si falla, y la lógica de la biblioteca del
// perfil (D-04b, DIS-6): permiso, contadores y favoritos multiformato.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Result = { data?: unknown; error?: unknown; count?: number }

/** Builder encadenable: registra cada filtro y resuelve con el resultado de su tabla. */
const calls: Array<{ table: string; method: string; args: unknown[] }> = []
const results: Record<string, Result[]> = {}
const rpc = vi.fn()

function builder(table: string) {
  const next = (): Result => (results[table]?.shift() ?? { data: null, error: null })
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'order', 'not', 'limit']) {
    b[m] = (...args: unknown[]) => {
      calls.push({ table, method: m, args })
      return b
    }
  }
  b.maybeSingle = () => Promise.resolve(next())
  b.then = (resolve: (r: Result) => unknown) => resolve(next())
  return b
}

const client = { from: (table: string) => builder(table), rpc: (...args: unknown[]) => rpc(...args) }

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => client,
}))

const OWNER = { id: 'u1', username: 'ana', avatar_color: '#000', avatar_initials: 'AN', avatar_icon: null, bio: 'hola' }
const media = (id: string, title: string, poster: string | null = `https://x/${id}.jpg`) => ({
  id, title, poster, type: id.split('_')[0], year: 2020,
})
const item = (id: string, title: string, added_at: string) => ({ media_id: id, added_at, media: media(id, title) })

beforeEach(() => {
  calls.length = 0
  for (const k of Object.keys(results)) delete results[k]
  rpc.mockReset()
})

describe('getPublicCollection (consulta anidada, REN-6)', () => {
  it('devuelve null si el usuario no existe', async () => {
    results.users = [{ data: null, error: null }]
    const { getPublicCollection } = await import('@/lib/social/public-collection')
    expect(await getPublicCollection('nadie')).toBeNull()
  })

  it('una sola consulta: dueño + listas públicas + títulos, con is_public explícito', async () => {
    results.users = [{ data: { ...OWNER, lists: [] }, error: null }]
    const { getPublicCollection } = await import('@/lib/social/public-collection')
    await getPublicCollection('ana')
    expect(new Set(calls.map((c) => c.table))).toEqual(new Set(['users']))
    expect(calls).toContainEqual({ table: 'users', method: 'eq', args: ['lists.is_public', true] })
    const select = calls.find((c) => c.method === 'select')?.args[0] as string
    // Pista de la FK: `lists` y `users` también se unen por list_members.
    expect(select).toContain('lists!lists_owner_id_fkey(')
    expect(select).toContain('list_items(')
  })

  it('omite listas vacías, ordena por formato y cada lista por fecha (más reciente primero)', async () => {
    results.users = [{
      data: {
        ...OWNER,
        lists: [
          { id: 'l-game', name: 'Juegos', media_type: 'game', created_at: '2026-10-03', list_items: [item('game_1', 'Zelda', '2026-10-03')] },
          { id: 'l-empty', name: 'Vacía', media_type: 'movie', created_at: '2026-10-04', list_items: [] },
          { id: 'l-old', name: 'Viejas', media_type: 'movie', created_at: '2026-01-01', list_items: [item('movie_9', 'Alien', '2026-01-01')] },
          {
            id: 'l-new', name: 'Nuevas', media_type: 'movie', created_at: '2026-10-01',
            list_items: [item('movie_1', 'Antigua', '2026-10-01'), item('movie_2', 'Reciente', '2026-10-02')],
          },
        ],
      },
      error: null,
    }]
    const { getPublicCollection } = await import('@/lib/social/public-collection')
    const res = await getPublicCollection('ana')
    expect(res?.lists.map((l) => l.id)).toEqual(['l-new', 'l-old', 'l-game'])
    expect(res?.lists[0].items.map((i) => i.title)).toEqual(['Reciente', 'Antigua'])
    expect(res?.lists[0].items[0]).toMatchObject({ mediaId: 'movie_2', type: 'movie', poster: 'https://x/movie_2.jpg' })
  })

  it('sin sesión solo pide las columnas que anon puede leer (F-02: nada de `*`)', async () => {
    results.users = [{ data: { ...OWNER, lists: [] }, error: null }]
    const { getPublicCollection } = await import('@/lib/social/public-collection')
    await getPublicCollection('ana')
    const select = calls.find((c) => c.method === 'select')?.args[0] as string
    expect(select.startsWith('id, username, avatar_color, avatar_initials, avatar_icon, bio, lists!')).toBe(true)
    expect(select).not.toContain('*')
    expect(select).not.toMatch(/library_visibility|preferred_locale/)
  })

  it('getOwnerDetails: fecha y visibilidad con sesión; sin la columna de F-12, solo la fecha', async () => {
    results.users = [
      { data: { created_at: '2026-01-01T00:00:00Z', library_visibility: 'friends' }, error: null },
      { data: null, error: { code: '42703' } },
      { data: { created_at: '2026-02-01T00:00:00Z' }, error: null },
      { data: null, error: { code: '42501' } },
    ]
    const { getOwnerDetails } = await import('@/lib/social/public-collection')
    expect(await getOwnerDetails(client as never, 'u1')).toEqual({ createdAt: '2026-01-01T00:00:00Z', libraryVisibility: 'friends' })
    expect(await getOwnerDetails(client as never, 'u1')).toEqual({ createdAt: '2026-02-01T00:00:00Z', libraryVisibility: null })
    expect(await getOwnerDetails(client as never, 'u1')).toEqual({ createdAt: null, libraryVisibility: null })
  })

  it('si la consulta anidada falla, vuelve a las tres consultas de siempre (con is_public explícito)', async () => {
    results.users = [
      { data: null, error: { code: 'PGRST201', message: 'more than one relationship' } },
      { data: OWNER, error: null },
    ]
    results.lists = [{ data: [{ id: 'l-movie', name: 'Pelis', media_type: 'movie' }], error: null }]
    results.list_items = [{ data: [{ list_id: 'l-movie', ...item('movie_2', 'Alien', '2026-10-01') }], error: null }]
    const { getPublicCollection } = await import('@/lib/social/public-collection')
    const res = await getPublicCollection('ana')
    expect(calls).toContainEqual({ table: 'lists', method: 'eq', args: ['is_public', true] })
    expect(calls).toContainEqual({ table: 'lists', method: 'eq', args: ['owner_id', 'u1'] })
    expect(res?.lists.map((l) => l.id)).toEqual(['l-movie'])
    expect(res?.owner.username).toBe('ana')
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

describe('viewerCanReadLibrary (D-04b)', () => {
  it('lo decide can_read_library', async () => {
    const { viewerCanReadLibrary } = await import('@/lib/social/public-collection')
    rpc.mockResolvedValueOnce({ data: true, error: null })
    expect(await viewerCanReadLibrary(client as never, 'u1')).toBe(true)
    expect(rpc).toHaveBeenCalledWith('can_read_library', { p_owner: 'u1' })
    rpc.mockResolvedValueOnce({ data: false, error: null })
    expect(await viewerCanReadLibrary(client as never, 'u1')).toBe(false)
  })

  it('sin la función (F-12 sin aplicar) rige W1: con sesión, sí', async () => {
    const { viewerCanReadLibrary } = await import('@/lib/social/public-collection')
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
    expect(await viewerCanReadLibrary(client as never, 'u1')).toBe(true)
  })

  it('cualquier otro error: no se enseña', async () => {
    const { viewerCanReadLibrary } = await import('@/lib/social/public-collection')
    rpc.mockResolvedValueOnce({ data: null, error: { code: '57014' } })
    expect(await viewerCanReadLibrary(client as never, 'u1')).toBe(false)
  })
})

describe('favoritos y contadores (DIS-6)', () => {
  const fav = (id: string, score: number, poster: string | null = 'p') => ({
    mediaId: id, title: id, poster, type: id.split('_')[0], score,
  })

  it('pickFavorites: los mejor puntuados, uno por formato y con portada primero', async () => {
    const { pickFavorites } = await import('@/lib/social/public-collection')
    const picked = pickFavorites([
      fav('movie_1', 5), fav('movie_2', 5), fav('movie_3', 5),
      fav('anime_1', 4), fav('game_1', 4, null), fav('book_1', 3), fav('game_2', 3),
    ])
    expect(picked.map((p) => p.mediaId)).toEqual(['movie_1', 'anime_1', 'book_1', 'game_2'])
  })

  it('pickFavorites: si no hay 4 formatos, completa con los siguientes mejor puntuados', async () => {
    const { pickFavorites } = await import('@/lib/social/public-collection')
    const picked = pickFavorites([fav('movie_1', 5), fav('movie_2', 4), fav('movie_3', 2), fav('tv_1', 3)])
    expect(picked.map((p) => p.mediaId)).toEqual(['movie_1', 'movie_2', 'tv_1', 'movie_3'])
    expect(pickFavorites([])).toEqual([])
  })

  it('countByFormat: por formato en el orden de la app, total y completados', async () => {
    const { countByFormat } = await import('@/lib/social/public-collection')
    expect(
      countByFormat([
        { media_id: 'game_1', status: 'completed' },
        { media_id: 'movie_1', status: 'completed' },
        { media_id: 'movie_2', status: 'pending' },
        { media_id: 'raro_1', status: 'completed' },
      ]),
    ).toEqual({
      total: 3,
      completed: 2,
      byFormat: [{ type: 'movie', count: 2 }, { type: 'game', count: 1 }],
    })
  })

  it('getLibraryShowcase: tres lecturas de user_media del dueño con la sesión de quien mira', async () => {
    results.user_media = [
      { data: [{ media_id: 'movie_1', status: 'completed' }, { media_id: 'anime_1', status: 'in_progress' }], error: null },
      {
        data: [
          { media_id: 'movie_1', score: 5, media: media('movie_1', 'Alien') },
          { media_id: 'anime_1', score: 4, media: media('anime_1', 'Akira') },
          { media_id: 'book_1', score: 3, media: null },
        ],
        error: null,
      },
      { data: [{ media_id: 'anime_1', media: media('anime_1', 'Akira') }], error: null },
    ]
    const { getLibraryShowcase } = await import('@/lib/social/public-collection')
    const res = await getLibraryShowcase(client as never, 'u1')
    expect(calls.filter((c) => c.table === 'user_media' && c.method === 'eq' && c.args[0] === 'user_id').length).toBe(3)
    expect(calls).toContainEqual({ table: 'user_media', method: 'not', args: ['score', 'is', null] })
    expect(res.total).toBe(2)
    expect(res.favorites.map((f) => [f.mediaId, f.score])).toEqual([['movie_1', 5], ['anime_1', 4]])
    expect(res.watching.map((w) => w.title)).toEqual(['Akira'])
  })

  it('getLibraryShowcase: con errores (RLS, red) devuelve todo vacío en vez de fallar', async () => {
    results.user_media = [
      { data: null, error: { code: '42501' } },
      { data: null, error: { code: '42501' } },
      { data: null, error: { code: '42501' } },
    ]
    const { getLibraryShowcase } = await import('@/lib/social/public-collection')
    expect(await getLibraryShowcase(client as never, 'u1')).toEqual({
      total: 0, completed: 0, byFormat: [], favorites: [], watching: [],
    })
  })
})
