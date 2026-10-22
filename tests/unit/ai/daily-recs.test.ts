// ============================================================
// KULTURA — "Para ti" con coste acotado (D-06 / ROJO-4)
//
// Contrato económico de `getDailyAiRecommendations`:
//   1. Como mucho UNA llamada al modelo por usuario, día e idioma: la respuesta
//      se guarda en `ai_recs` (o en memoria si la tabla no existe) y se
//      reutiliza el resto del día.
//   2. Con el tope global agotado no se llama al modelo: se sirve el orden por
//      match con `source: 'match', capped: true`.
//   3. Dos clics a la vez no pagan dos veces.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MediaItem, MediaType } from '@/types/media'

const { fetchDiscoverDataMock, computeMatchScoresMock, adminClientMock, createMock } = vi.hoisted(() => ({
  fetchDiscoverDataMock: vi.fn(),
  computeMatchScoresMock: vi.fn(),
  adminClientMock: vi.fn(),
  createMock: vi.fn(),
}))

vi.mock('@/lib/api/discover', () => ({ fetchDiscoverData: fetchDiscoverDataMock }))
vi.mock('@/lib/recommendations/match-score', () => ({ computeMatchScores: computeMatchScoresMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: adminClientMock }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock }
  },
}))

const ALL_TYPES: MediaType[] = ['movie', 'tv', 'anime', 'book', 'manga', 'comic', 'game']

function makeItem(type: MediaType, externalId: string): MediaItem {
  return {
    id: `${type}_${externalId}`,
    externalId,
    type,
    title: `${type} ${externalId}`,
    poster: `https://img/${type}-${externalId}.jpg`,
    year: 2024,
    genres: ['Action'],
  }
}

const LIBRARY_ROWS = Array.from({ length: 5 }, (_, i) => ({
  status: 'completed',
  score: 4,
  media: { title: `Film ${i}`, type: 'movie', year: 2020 },
}))

/** Cliente de usuario (RLS) con las dos lecturas de biblioteca del módulo. */
function userClient() {
  return {
    from: vi.fn(() => ({
      select: vi.fn((columns: string) => {
        if (columns === 'media_id') {
          return { eq: vi.fn().mockResolvedValue({ data: [], error: null }) }
        }
        const chain: Record<string, unknown> = {}
        chain.eq = vi.fn(() => chain)
        chain.or = vi.fn(() => chain)
        chain.order = vi.fn(() => chain)
        chain.limit = vi.fn().mockResolvedValue({ data: LIBRARY_ROWS, error: null })
        return chain
      }),
    })),
  } as never
}

const MISSING_TABLE = { code: '42P01', message: 'relation "public.ai_recs" does not exist' }
const MISSING_FN = { code: 'PGRST202', message: 'Could not find the function' }

/**
 * Cliente admin. `migrated: false` → la tabla y la función no existen (cada
 * acceso devuelve el error de Postgres/PostgREST). `migrated: true` → `ai_recs`
 * emulada con un Map y `increment_ai_usage` con un contador y su tope.
 */
function adminDb({ migrated, usage = 0 }: { migrated: boolean; usage?: number }) {
  const rows = new Map<string, unknown>()
  let calls = usage
  const upserts: unknown[] = []
  const client = {
    rpc: vi.fn(async (_fn: string, args: { p_cap: number }) => {
      if (!migrated) return { data: null, error: MISSING_FN }
      if (calls >= args.p_cap) return { data: false, error: null }
      calls += 1
      return { data: true, error: null }
    }),
    from: vi.fn(() => {
      const filters: Record<string, string> = {}
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((col: string, val: string) => {
          filters[col] = val
          return chain
        }),
        maybeSingle: vi.fn(async () => {
          if (!migrated) return { data: null, error: MISSING_TABLE }
          const key = `${filters.user_id}|${filters.day}|${filters.locale}`
          return { data: rows.has(key) ? { payload: rows.get(key) } : null, error: null }
        }),
        delete: vi.fn(() => chain),
        lt: vi.fn(async (col: string, val: string) => {
          if (!migrated) return { data: null, error: MISSING_TABLE }
          Array.from(rows.keys()).forEach((key) => {
            const [user, day] = key.split('|')
            if (user === filters.user_id && col === 'day' && day < val) rows.delete(key)
          })
          return { data: null, error: null }
        }),
        upsert: vi.fn(async (row: { user_id: string; day: string; locale: string; payload: unknown }) => {
          upserts.push(row)
          if (!migrated) return { data: null, error: MISSING_TABLE }
          rows.set(`${row.user_id}|${row.day}|${row.locale}`, row.payload)
          return { data: null, error: null }
        }),
      }
      return chain
    }),
  }
  adminClientMock.mockImplementation(() => client)
  return { client, rows, upserts, usage: () => calls }
}

function picksResponse() {
  return { content: [{ type: 'text', text: '{"picks":[{"id":"movie_1","reason":"Tiene el mismo tono que tus favoritas."}]}' }] }
}

async function load() {
  return import('@/lib/claude/recommendations')
}

beforeEach(() => {
  vi.resetModules()
  fetchDiscoverDataMock.mockReset()
  computeMatchScoresMock.mockReset()
  adminClientMock.mockReset()
  createMock.mockReset()
  createMock.mockResolvedValue(picksResponse())
  fetchDiscoverDataMock.mockImplementation(async (type: MediaType) => ({
    items: [makeItem(type, '1'), makeItem(type, '2'), makeItem(type, '3')],
    totalPages: 1,
    hasMore: false,
    fetchErrorKind: null,
  }))
  computeMatchScoresMock.mockImplementation(async (_u: string, items: MediaItem[]) =>
    new Map(items.map((item) => [item.id, 50]))
  )
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('getDailyAiRecommendations — una llamada por usuario y día', () => {
  it('20 peticiones del mismo usuario el mismo día → el modelo se llama 1 vez (sin migrar: memoria)', async () => {
    adminDb({ migrated: false })
    const { getDailyAiRecommendations } = await load()

    const results = []
    for (let i = 0; i < 20; i++) {
      results.push(await getDailyAiRecommendations('u-20', [], 'es', userClient()))
    }

    expect(createMock).toHaveBeenCalledTimes(1)
    // Todas las respuestas son la misma recomendación del día.
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1)
    expect(results[0].source).toBe('ai')
    expect(results[0].recommendations.map((r) => r.item.type)).toEqual(ALL_TYPES)
    expect(results[0].recommendations[0].reason).toBe('Tiene el mismo tono que tus favoritas.')
  })

  it('20 peticiones con la migración aplicada → 1 llamada y la fila queda en ai_recs', async () => {
    const db = adminDb({ migrated: true })
    const { getDailyAiRecommendations } = await load()

    for (let i = 0; i < 20; i++) await getDailyAiRecommendations('u-db', [], 'es', userClient())

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(db.rows.size).toBe(1)
    expect(db.usage()).toBe(1)
  })

  it('lo guardado en ai_recs lo sirve otra instancia sin volver a llamar al modelo', async () => {
    const db = adminDb({ migrated: true })
    const first = await (await load()).getDailyAiRecommendations('u-cold', [], 'es', userClient())
    expect(createMock).toHaveBeenCalledTimes(1)

    // Instancia nueva: memoria vacía, misma base.
    vi.resetModules()
    adminClientMock.mockImplementation(() => db.client)
    const second = await (await load()).getDailyAiRecommendations('u-cold', [], 'es', userClient())

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })

  it('dos clics simultáneos comparten la misma llamada', async () => {
    adminDb({ migrated: true })
    const { getDailyAiRecommendations } = await load()

    await Promise.all([
      getDailyAiRecommendations('u-race', [], 'es', userClient()),
      getDailyAiRecommendations('u-race', [], 'es', userClient()),
      getDailyAiRecommendations('u-race', [], 'es', userClient()),
    ])

    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('al día siguiente sí hay una llamada nueva', async () => {
    adminDb({ migrated: true })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z'))
    const { getDailyAiRecommendations } = await load()

    await getDailyAiRecommendations('u-day', [], 'es', userClient())
    await getDailyAiRecommendations('u-day', [], 'es', userClient())
    vi.setSystemTime(new Date('2026-10-23T10:00:00Z'))
    await getDailyAiRecommendations('u-day', [], 'es', userClient())

    expect(createMock).toHaveBeenCalledTimes(2)
  })

  it('al guardar las de hoy se borran las de días anteriores del usuario (minimización)', async () => {
    const db = adminDb({ migrated: true })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z'))
    const { getDailyAiRecommendations } = await load()

    await getDailyAiRecommendations('u-min', [], 'es', userClient())
    vi.setSystemTime(new Date('2026-10-23T10:00:00Z'))
    await getDailyAiRecommendations('u-min', [], 'es', userClient())

    expect(Array.from(db.rows.keys())).toEqual(['u-min|2026-10-23|es'])
  })

  it('cambiar la biblioteca (invalidateRecCache) no abre una segunda llamada el mismo día', async () => {
    adminDb({ migrated: true })
    const { getDailyAiRecommendations, invalidateRecCache } = await load()

    await getDailyAiRecommendations('u-inv', [], 'es', userClient())
    invalidateRecCache('u-inv')
    await getDailyAiRecommendations('u-inv', [], 'es', userClient())

    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('biblioteca corta → [] sin guardar nada: al llegar a 3 títulos puede recomendar ese mismo día', async () => {
    const db = adminDb({ migrated: true })
    const { getDailyAiRecommendations } = await load()
    const shortLibrary = {
      from: vi.fn(() => ({
        select: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.or = vi.fn(() => chain)
          chain.order = vi.fn(() => chain)
          chain.limit = vi.fn().mockResolvedValue({ data: LIBRARY_ROWS.slice(0, 2), error: null })
          return chain
        }),
      })),
    } as never

    const res = await getDailyAiRecommendations('u-short', [], 'es', shortLibrary)
    expect(res.recommendations).toEqual([])
    expect(db.rows.size).toBe(0)
    expect(createMock).not.toHaveBeenCalled()

    await getDailyAiRecommendations('u-short', [], 'es', userClient())
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('si el modelo falla no se guarda: el usuario puede reintentar (y el tope global sigue mandando)', async () => {
    const db = adminDb({ migrated: true })
    createMock.mockRejectedValueOnce(new Error('overloaded'))
    const { getDailyAiRecommendations } = await load()

    const first = await getDailyAiRecommendations('u-err', [], 'es', userClient())
    expect(first.source).toBe('match')
    expect(first.recommendations).toHaveLength(7)
    expect(db.rows.size).toBe(0)

    const second = await getDailyAiRecommendations('u-err', [], 'es', userClient())
    expect(second.source).toBe('ai')
    expect(createMock).toHaveBeenCalledTimes(2)
    expect(db.usage()).toBe(2)
  })
})

describe('getDailyAiRecommendations — tope global (AI_DAILY_CALL_CAP)', () => {
  it('con ai_usage en el tope → 0 llamadas, orden por match y capped:true', async () => {
    adminDb({ migrated: true, usage: 100 })
    const { getDailyAiRecommendations } = await load()

    const res = await getDailyAiRecommendations('u-capped', [], 'es', userClient())

    expect(createMock).not.toHaveBeenCalled()
    expect(res.source).toBe('match')
    expect(res.capped).toBe(true)
    // La sección no se queda vacía: el de mayor match de cada tipo, sin frase.
    expect(res.recommendations.map((r) => r.item.type)).toEqual(ALL_TYPES)
    expect(res.recommendations.every((r) => r.reason === undefined)).toBe(true)
  })

  it('el tope se comparte entre usuarios: el 3.º usuario con tope 2 ya no llama', async () => {
    vi.stubEnv('AI_DAILY_CALL_CAP', '2')
    adminDb({ migrated: true })
    const { getDailyAiRecommendations } = await load()

    await getDailyAiRecommendations('u-a', [], 'es', userClient())
    await getDailyAiRecommendations('u-b', [], 'es', userClient())
    const third = await getDailyAiRecommendations('u-c', [], 'es', userClient())

    expect(createMock).toHaveBeenCalledTimes(2)
    expect(third.capped).toBe(true)
  })

  it('sin ANTHROPIC_API_KEY no gasta cupo y responde por match (sin capped)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const db = adminDb({ migrated: true })
    const { getDailyAiRecommendations } = await load()

    const res = await getDailyAiRecommendations('u-nokey', [], 'es', userClient())

    expect(createMock).not.toHaveBeenCalled()
    expect(db.usage()).toBe(0)
    expect(res.source).toBe('match')
    expect(res.capped).toBeUndefined()
  })

  it('getAiRecommendations (la función de siempre) también respeta el tope', async () => {
    adminDb({ migrated: true, usage: 100 })
    const { getAiRecommendations } = await load()

    const recs = await getAiRecommendations('u-legacy', [], 'es', userClient())

    expect(createMock).not.toHaveBeenCalled()
    expect(recs).toHaveLength(7)
  })
})

describe('readTodayAiRecommendations — lectura sin coste para pintar Inicio', () => {
  it('devuelve lo de hoy si existe y null si no, sin llamar nunca al modelo', async () => {
    adminDb({ migrated: true })
    const { getDailyAiRecommendations, readTodayAiRecommendations } = await load()

    expect(await readTodayAiRecommendations('u-read', 'es')).toBeNull()
    const made = await getDailyAiRecommendations('u-read', [], 'es', userClient())
    expect(await readTodayAiRecommendations('u-read', 'es')).toEqual(made)
    expect(await readTodayAiRecommendations('u-read', 'en')).toBeNull()
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('con la tabla sin migrar no lanza', async () => {
    adminDb({ migrated: false })
    const { readTodayAiRecommendations } = await load()
    expect(await readTodayAiRecommendations('u-x', 'es')).toBeNull()
  })

  it('una fila con forma rara se ignora en vez de romper Inicio', async () => {
    const db = adminDb({ migrated: true })
    const { readTodayAiRecommendations } = await load()
    const { aiDay } = await import('@/lib/claude/budget')
    db.rows.set(`u-bad|${aiDay()}|es`, { recommendations: 'no' })
    expect(await readTodayAiRecommendations('u-bad', 'es')).toBeNull()
  })
})
