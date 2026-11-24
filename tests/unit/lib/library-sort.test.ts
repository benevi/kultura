// Fase 8.5 · B2: el orden de la Biblioteca en «Sala».
import { describe, it, expect } from 'vitest'
import { entryRating10, parseLibrarySort, sortLibrary } from '@/lib/library/sort'
import type { LibraryEntry } from '@/types/library'

function entry(mediaId: string, extra: Partial<LibraryEntry> = {}): LibraryEntry {
  return { id: mediaId, userId: 'u', mediaId, status: 'completed', score: null, watchedAt: null, episodeProgress: null, createdAt: '2026-01-01', ...extra }
}

// En el orden del servidor: los añadidos hace menos primero.
const ENTRIES = [
  entry('movie_1', { title: 'Zodiac', year: 2007, rating10: 7 }),
  entry('book_2', { title: 'ánimas', year: undefined, rating10: null }),
  entry('game_3', { title: 'Alan Wake 2', year: 2023, score: 5 }),
  entry('tv_4', { title: 'alan wake 10', year: 2007, rating10: 9.5 }),
  entry('manga_5', { title: undefined, year: 2001 }),
]

const ids = (list: LibraryEntry[]) => list.map((e) => e.mediaId)

describe('parseLibrarySort', () => {
  it('los cuatro órdenes; cualquier otra cosa es el de siempre', () => {
    for (const s of ['recent', 'title', 'year', 'rating']) expect(parseLibrarySort(s)).toBe(s)
    for (const s of [null, undefined, '', 'RATING', 'created_at']) expect(parseLibrarySort(s)).toBe('recent')
  })
})

describe('sortLibrary', () => {
  it('recent: el orden del servidor, en una copia', () => {
    const out = sortLibrary(ENTRIES, 'recent', 'es')
    expect(ids(out)).toEqual(ids(ENTRIES))
    expect(out).not.toBe(ENTRIES)
  })

  it('title: A-Z con las reglas del idioma (sin mayúsculas ni tildes, números como números)', () => {
    expect(ids(sortLibrary(ENTRIES, 'title', 'es'))).toEqual(['game_3', 'tv_4', 'book_2', 'manga_5', 'movie_1'])
  })

  it('year: los más nuevos primero, sin año al final y empates en el orden del servidor', () => {
    expect(ids(sortLibrary(ENTRIES, 'year', 'es'))).toEqual(['game_3', 'movie_1', 'tv_4', 'manga_5', 'book_2'])
  })

  it('rating: la nota más alta primero (la fina o la entera × 2), sin nota al final', () => {
    expect(ids(sortLibrary(ENTRIES, 'rating', 'es'))).toEqual(['game_3', 'tv_4', 'movie_1', 'book_2', 'manga_5'])
  })

  it('entryRating10: la fina si la hay; si no, la entera × 2', () => {
    expect(entryRating10(entry('a', { rating10: 7.5, score: 4 }))).toBe(7.5)
    expect(entryRating10(entry('a', { score: 3 }))).toBe(6)
    expect(entryRating10(entry('a'))).toBeNull()
  })
})
