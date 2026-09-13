// ============================================================
// KULTURA — Route Handler /api/account/import unit tests
//
// El export existía pero no la vuelta: el fichero que el usuario se descarga
// "para no perder sus datos" no servía para recuperarlos.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()

/** Registra los upserts/inserts por tabla para poder afirmar sobre ellos. */
const writes: Record<string, unknown[][]> = {}
const listRows: Array<{ id: string; name: string }> = []
const knownMediaIds: string[] = []

function tableStub(table: string) {
  const record = (op: string, payload: unknown) => {
    writes[`${table}.${op}`] = writes[`${table}.${op}`] ?? []
    writes[`${table}.${op}`].push([payload])
  }

  return {
    upsert: vi.fn(async (payload: unknown) => {
      record('upsert', payload)
      return { error: null }
    }),
    insert: vi.fn((payload: unknown) => {
      record('insert', payload)
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: 'new-list-id' }, error: null })),
        })),
        // list_items: insert sin .select() → se espera la promesa directamente.
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      }
    }),
    select: vi.fn(() => ({
      eq: vi.fn(async () => ({
        data: table === 'lists' ? listRows : [],
        error: null,
      })),
      in: vi.fn(async () => ({
        data: knownMediaIds.map((id) => ({ id })),
        error: null,
      })),
    })),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => tableStub(table)),
  }),
}))

const mockCheckRateLimit = vi.fn<() => { allowed: boolean; retryAfterSeconds: number }>(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => mockCheckRateLimit() }
})

const mockInvalidateRec = vi.fn()
const mockInvalidateMatch = vi.fn()
vi.mock('@/lib/claude/recommendations', () => ({ invalidateRecCache: mockInvalidateRec }))
vi.mock('@/lib/recommendations/match-score', () => ({
  invalidateMatchScoreCache: mockInvalidateMatch,
}))

const AUTH_USER = { id: 'user-001', email: 'user@example.com' }

function req(body: unknown): Request {
  return new Request('http://localhost/api/account/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function post(body: unknown) {
  const { POST } = await import('@/app/api/account/import/route')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return POST(req(body) as any)
}

const ENTRY = {
  mediaId: 'movie_550',
  status: 'completed',
  score: 5,
  watchedAt: '2026-01-01',
  title: 'Fight Club',
  poster: 'https://img/fc.jpg',
  year: 1999,
}

describe('POST /api/account/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(writes)) delete writes[key]
    listRows.length = 0
    knownMediaIds.length = 0
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
  })

  it('401 si no hay sesión', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await post({ library: [] })).status).toBe(401)
  })

  it('429 cuando se supera el límite', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })
    expect((await post({ library: [] })).status).toBe(429)
  })

  it('400 si el JSON está corrupto', async () => {
    expect((await post('{ esto no es json')).status).toBe(400)
  })

  it('400 si el fichero no es un export de Kultura', async () => {
    const res = await post({ algo: 'otra cosa' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('library')
  })

  it('reconstruye la ficha del título y la entrada de biblioteca', async () => {
    const res = await post({ library: [ENTRY] })

    expect(res.status).toBe(200)
    expect((await res.json()).libraryImported).toBe(1)

    // media: el tipo y el id externo salen del propio mediaId.
    expect(writes['media.upsert'][0][0]).toEqual([
      {
        id: 'movie_550',
        external_id: '550',
        type: 'movie',
        title: 'Fight Club',
        poster: 'https://img/fc.jpg',
        year: 1999,
      },
    ])
    expect(writes['user_media.upsert'][0][0]).toEqual([
      {
        user_id: AUTH_USER.id,
        media_id: 'movie_550',
        status: 'completed',
        score: 5,
        watched_at: '2026-01-01',
      },
    ])
  })

  it('importa SIEMPRE al usuario autenticado, nunca al del fichero', async () => {
    await post({
      profile: { id: 'otra-persona' },
      library: [{ ...ENTRY, userId: 'otra-persona' }],
    })

    const rows = writes['user_media.upsert'][0][0] as Array<{ user_id: string }>
    expect(rows[0].user_id).toBe(AUTH_USER.id)
  })

  it('descarta entradas inválidas sin tumbar el resto', async () => {
    const res = await post({
      library: [
        ENTRY,
        { mediaId: 'sin-guion-bajo', status: 'completed' }, // formato inválido
        { mediaId: 'movie_1', status: 'inventado' }, // estado inválido
        null,
      ],
    })

    const body = await res.json()
    expect(body.libraryImported).toBe(1)
    expect(body.librarySkipped).toBe(3)
  })

  it('una puntuación fuera de 1-5 se guarda como nula en vez de reventar', async () => {
    await post({ library: [{ ...ENTRY, score: 99 }] })
    const rows = writes['user_media.upsert'][0][0] as Array<{ score: number | null }>
    expect(rows[0].score).toBeNull()
  })

  it('no recrea una lista que ya existe con ese nombre (idempotente)', async () => {
    listRows.push({ id: 'list-existente', name: 'Pendientes' })

    const res = await post({
      library: [],
      lists: [{ name: 'Pendientes', items: [] }],
    })

    expect((await res.json()).listsImported).toBe(0)
    expect(writes['lists.insert']).toBeUndefined()
  })

  it('crea las listas nuevas con su contenido', async () => {
    knownMediaIds.push('movie_550')

    const res = await post({
      library: [ENTRY],
      lists: [{ name: 'Favoritas', mediaType: 'movie', isCollaborative: false, items: ['movie_550'] }],
    })

    expect((await res.json()).listsImported).toBe(1)
    expect(writes['list_items.insert'][0][0]).toEqual([
      { list_id: 'new-list-id', media_id: 'movie_550', added_by: AUTH_USER.id },
    ])
  })

  it('omite los items de lista cuyo título no existe (FK inválida)', async () => {
    // knownMediaIds vacío → ninguno está en `media`.
    await post({
      library: [],
      lists: [{ name: 'Favoritas', items: ['movie_999'] }],
    })

    expect(writes['list_items.insert']).toBeUndefined()
  })

  it('no importa amistades: no pueden recrearse unilateralmente', async () => {
    const res = await post({
      library: [],
      friendships: [{ friendshipId: 'f-1' }, { friendshipId: 'f-2' }],
    })

    expect((await res.json()).friendshipsImported).toBe(0)
  })

  it('invalida el perfil de gustos y las recomendaciones tras repoblar la biblioteca', async () => {
    await post({ library: [ENTRY] })

    expect(mockInvalidateMatch).toHaveBeenCalledWith(AUTH_USER.id)
    expect(mockInvalidateRec).toHaveBeenCalledWith(AUTH_USER.id)
  })
})
