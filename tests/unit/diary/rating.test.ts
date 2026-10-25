// ============================================================
// F-24 · Escala de notas (D-14): conversiones sin pérdida y redondeos
// iguales a los del disparador user_media_sync_rating.
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  entryRating10,
  formatRating,
  halfStarsToRating10,
  isValidRating10,
  letterboxdToRating10,
  normalizeRating10,
  rating10ToHalfStars,
  rating10ToScore,
  scoreToRating10,
} from '@/lib/library/rating'
import { parseLogInput, isValidDiaryDate } from '@/lib/library/diary'

describe('rating10', () => {
  it('solo vale de 0,5 a 10 en pasos de 0,5', () => {
    for (const ok of [0.5, 1, 4.5, 7.5, 9, 10]) expect(isValidRating10(ok), String(ok)).toBe(true)
    for (const bad of [0, -1, 0.25, 7.3, 10.5, NaN, Infinity, '9', null]) {
      expect(isValidRating10(bad), String(bad)).toBe(false)
    }
  })

  it('score 3 → rating10 6 y viceversa (aceptación)', () => {
    expect(scoreToRating10(3)).toBe(6)
    expect(rating10ToScore(6)).toBe(3)
    for (const s of [1, 2, 3, 4, 5]) expect(rating10ToScore(scoreToRating10(s))).toBe(s)
  })

  it('a score redondea mitad hacia arriba y nunca baja de 1 (como round() de Postgres)', () => {
    expect(rating10ToScore(9)).toBe(5)
    expect(rating10ToScore(7.5)).toBe(4)
    expect(rating10ToScore(5)).toBe(3)
    expect(rating10ToScore(1)).toBe(1)
    expect(rating10ToScore(0.5)).toBe(1)
    expect(rating10ToScore(null)).toBeNull()
    expect(rating10ToScore(11)).toBeNull()
  })

  it('score inválido no da nota', () => {
    expect(scoreToRating10(0)).toBeNull()
    expect(scoreToRating10(3.5)).toBeNull()
    expect(scoreToRating10(null)).toBeNull()
    expect(scoreToRating10(undefined)).toBeNull()
  })

  it('entryRating10: la guardada; sin migración, score × 2', () => {
    expect(entryRating10({ rating10: 9, score: 5 })).toBe(9)
    expect(entryRating10({ score: 4 })).toBe(8)
    expect(entryRating10({ rating10: null, score: null })).toBeNull()
  })

  it('normalizeRating10 lleva al paso de 0,5 más cercano y acota', () => {
    expect(normalizeRating10(7.3)).toBe(7.5)
    expect(normalizeRating10('8,2')).toBe(8)
    expect(normalizeRating10(12)).toBe(10)
    expect(normalizeRating10(0.1)).toBe(0.5)
    expect(normalizeRating10(0)).toBeNull()
    expect(normalizeRating10('x')).toBeNull()
  })
})

describe('Letterboxd → rating10', () => {
  it('4,5★ se guarda como 9 sin pérdida (aceptación)', () => {
    expect(letterboxdToRating10('4.5')).toBe(9)
    expect(letterboxdToRating10(4.5)).toBe(9)
    expect(letterboxdToRating10('4,5')).toBe(9)
    // Y 9 sigue siendo 4,5★ al pintarlo en medias estrellas.
    expect(rating10ToHalfStars(9)).toBe(4.5)
  })

  it('todas las notas de Letterboxd (½ a 5) caen en un rating10 válido', () => {
    for (let stars = 0.5; stars <= 5; stars += 0.5) {
      const r = letterboxdToRating10(String(stars))
      expect(r).toBe(stars * 2)
      expect(isValidRating10(r)).toBe(true)
    }
  })

  it('vacío o fuera de escala → sin nota (no se inventa otra)', () => {
    expect(letterboxdToRating10('')).toBeNull()
    expect(letterboxdToRating10('  ')).toBeNull()
    expect(letterboxdToRating10(null)).toBeNull()
    expect(letterboxdToRating10('4.3')).toBeNull()
    expect(letterboxdToRating10('6')).toBeNull()
    expect(letterboxdToRating10('abc')).toBeNull()
  })
})

describe('medias estrellas y texto', () => {
  it('rating10 ↔ estrellas en medias', () => {
    expect(rating10ToHalfStars(7)).toBe(3.5)
    expect(rating10ToHalfStars(7.5)).toBe(4)
    expect(rating10ToHalfStars(null)).toBe(0)
    expect(halfStarsToRating10(3.5)).toBe(7)
    expect(halfStarsToRating10(0)).toBeNull()
  })

  it('formatRating según la preferencia y el idioma', () => {
    expect(formatRating(7.5, 'ten', 'es')).toBe('7,5/10')
    expect(formatRating(9, 'stars', 'es')).toBe('4,5 ★')
    expect(formatRating(9, 'stars', 'en')).toBe('4.5 ★')
    expect(formatRating(8, 'ten', 'en')).toBe('8/10')
    expect(formatRating(null, 'ten', 'es')).toBe('')
  })
})

describe('apunte del diario', () => {
  it('valida fecha, nota, textos y booleanos', () => {
    expect(parseLogInput({ watchedOn: '2026-10-20', rewatch: true, review: 'Muy buena', spoiler: true })).toEqual({
      ok: true,
      log: { watchedOn: '2026-10-20', rewatch: true, rating10: undefined, review: 'Muy buena', spoiler: true, privateNote: null },
    })
    expect(parseLogInput({ watchedOn: '2026-02-30' }).ok).toBe(false)
    expect(parseLogInput({ watchedOn: '3000-01-01' }).ok).toBe(false)
    expect(parseLogInput({ rating10: 7.3 }).ok).toBe(false)
    expect(parseLogInput({ rewatch: 'sí' }).ok).toBe(false)
    expect(parseLogInput({ review: 'a'.repeat(5001) }).ok).toBe(false)
    expect(parseLogInput({ privateNote: 'a'.repeat(2001) }).ok).toBe(false)
    expect(parseLogInput('x').ok).toBe(false)
    expect(parseLogInput([]).ok).toBe(false)
  })

  it('sin reseña no hay spoiler; los textos vacíos son null', () => {
    const parsed = parseLogInput({ review: '   ', spoiler: true, privateNote: '' })
    expect(parsed).toEqual({
      ok: true,
      log: { watchedOn: null, rewatch: false, rating10: undefined, review: null, spoiler: false, privateNote: null },
    })
  })

  it('fechas: reales, desde 1900 y como mucho mañana', () => {
    expect(isValidDiaryDate('1900-01-01')).toBe(true)
    expect(isValidDiaryDate('1899-12-31')).toBe(false)
    expect(isValidDiaryDate(new Date().toISOString().slice(0, 10))).toBe(true)
    expect(isValidDiaryDate('2026-13-01')).toBe(false)
    expect(isValidDiaryDate('20-10-2026')).toBe(false)
  })
})
