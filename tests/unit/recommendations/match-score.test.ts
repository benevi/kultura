// ============================================================
// KULTURA — match-score unit tests (F3a)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import {
  buildTasteProfile,
  scoreItem,
  computeMatchScores,
  invalidateMatchScoreCache,
} from '@/lib/recommendations/match-score'
import type { MediaItem } from '@/types/media'

function item(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'movie_1',
    externalId: '1',
    type: 'movie',
    title: 'Test Movie',
    genres: [],
    ...overrides,
  }
}

describe('buildTasteProfile', () => {
  it('excluye filas sin señal real (pending/abandoned sin score)', () => {
    const profile = buildTasteProfile([
      { status: 'pending', score: null, media: { type: 'movie', metadata: { genres: ['Drama'] } } },
      { status: 'abandoned', score: null, media: { type: 'movie', metadata: { genres: ['Drama'] } } },
    ])
    expect(profile.signalCount).toBe(0)
    expect(profile.genreWeights.size).toBe(0)
  })

  it('pondera por score cuando existe, y por status cuando no', () => {
    const profile = buildTasteProfile([
      { status: 'completed', score: 5, media: { type: 'movie', metadata: { genres: ['Drama'] } } },
      { status: 'completed', score: null, media: { type: 'tv', metadata: { genres: ['Comedy'] } } },
      { status: 'in_progress', score: null, media: { type: 'anime', metadata: { genres: ['Action'] } } },
    ])
    expect(profile.signalCount).toBe(3)
    // Drama (peso 5) es el género dominante → normalizado a 1
    expect(profile.genreWeights.get('Drama')).toBe(1)
    // Comedy (peso 3, status completed sin score) < Drama
    expect(profile.genreWeights.get('Comedy')).toBeCloseTo(3 / 5)
    // Action (peso 1, in_progress) es el más bajo
    expect(profile.genreWeights.get('Action')).toBeCloseTo(1 / 5)
  })

  it('ignora filas sin media asociada (join nulo)', () => {
    const profile = buildTasteProfile([
      { status: 'completed', score: 5, media: null },
    ])
    expect(profile.signalCount).toBe(0)
  })

  it('acumula el mismo género a través de varios items', () => {
    const profile = buildTasteProfile([
      { status: 'completed', score: 4, media: { type: 'movie', metadata: { genres: ['Drama'] } } },
      { status: 'completed', score: 3, media: { type: 'tv', metadata: { genres: ['Drama'] } } },
    ])
    // Drama acumula 4+3=7, es el único género → normalizado a 1
    expect(profile.genreWeights.get('Drama')).toBe(1)
  })
})

describe('scoreItem', () => {
  const profile = {
    genreWeights: new Map([['Drama', 1], ['Comedy', 0.5]]),
    typeWeights: new Map([['movie', 1], ['tv', 0.4]]),
    signalCount: 5,
  }

  it('da score alto a un item que coincide con el género y tipo favoritos', () => {
    const score = scoreItem(item({ genres: ['Drama'], type: 'movie' }), profile)
    // genreScore=1*0.7 + typeScore=1*0.15 + social=0 → 85
    expect(score).toBe(85)
  })

  it('da 0 a un item sin ninguna señal de afinidad', () => {
    const score = scoreItem(item({ genres: ['Horror'], type: 'book' }), profile)
    expect(score).toBe(0)
  })

  it('promedia la afinidad cuando el item tiene varios géneros', () => {
    const score = scoreItem(item({ genres: ['Drama', 'Comedy'], type: 'movie' }), profile)
    // genreScore = (1+0.5)/2 = 0.75 → 0.75*0.7 + 1*0.15 = 0.675 → 68 (redondeo half-away-from-zero de Math.round)
    expect(score).toBe(68)
  })

  it('da 0 de componente de género cuando el item no tiene géneros', () => {
    const score = scoreItem(item({ genres: [], type: 'movie' }), profile)
    // solo typeScore: 1*0.15 = 0.15 → 15
    expect(score).toBe(15)
  })

  it('la señal social suma hasta un 15% adicional', () => {
    const withoutSocial = scoreItem(item({ genres: [], type: 'book' }), profile, 0)
    const withSocial = scoreItem(item({ genres: [], type: 'book' }), profile, 1)
    expect(withoutSocial).toBe(0)
    expect(withSocial).toBe(15)
  })

  it('nunca devuelve fuera de 0-100', () => {
    const score = scoreItem(item({ genres: ['Drama'], type: 'movie' }), profile, 1)
    expect(score).toBeLessThanOrEqual(100)
    expect(score).toBeGreaterThanOrEqual(0)
  })
})

describe('computeMatchScores — gate por señal insuficiente', () => {
  beforeEach(() => {
    invalidateMatchScoreCache('user-1')
  })

  it('devuelve un Map vacío cuando la biblioteca no tiene señal mínima (gate)', async () => {
    // Solo 2 filas con señal real (< MIN_LIBRARY_SIGNAL = 3)
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { status: 'completed', score: 5, media: { type: 'movie', metadata: { genres: ['Drama'] } } },
            { status: 'completed', score: 4, media: { type: 'tv', metadata: { genres: ['Comedy'] } } },
          ],
        }),
      }),
    }

    const scores = await computeMatchScores('user-1', [item()], supabase as never)
    expect(scores.size).toBe(0)
  })

  it('con señal suficiente, calcula score real incluyendo señal social de amigos', async () => {
    // user_media se consulta dos veces: 1ª para el perfil propio (select().eq()),
    // 2ª para la señal social de amigos (select().in().in()). Cada llamada a
    // supabase.from() en el código real pide un builder nuevo, así que un
    // contador de llamadas basta para diferenciarlas sin acoplar al orden interno.
    let userMediaCalls = 0
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { status: 'completed', score: 5, media: { type: 'movie', metadata: { genres: ['Drama'] } } },
          { status: 'completed', score: 4, media: { type: 'movie', metadata: { genres: ['Drama'] } } },
          { status: 'completed', score: 5, media: { type: 'movie', metadata: { genres: ['Drama'] } } },
        ],
      }),
    }
    const socialChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    }
    socialChain.in = vi.fn().mockImplementation(() => ({
      in: vi.fn().mockResolvedValue({ data: [{ media_id: 'movie_1', status: 'completed', score: 5 }] }),
    }))
    const friendshipsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [{ requester_id: 'user-1', receiver_id: 'friend-1' }] }),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'friendships') return friendshipsChain
        userMediaCalls++
        return userMediaCalls === 1 ? profileChain : socialChain
      }),
    }

    const scores = await computeMatchScores(
      'user-1',
      [item({ genres: ['Drama'], type: 'movie' })],
      supabase as never
    )
    // genreScore=1, typeScore=1, socialScore=1 (1/1 amigos con completed)
    // → round((1*0.7 + 1*0.15 + 1*0.15)*100) = 100
    expect(scores.get('movie_1')).toBe(100)
  })
})
