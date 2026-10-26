// @vitest-environment node
// F-26 — El CSV exportado tiene el formato de importación de Letterboxd
// (letterboxd.com/about/importing-data) y KULTURA lo vuelve a leer igual.
import { describe, expect, it } from 'vitest'
import { buildLetterboxdCsv, letterboxdStars, tmdbMovieId, type ExportEntry, type ExportLog } from '@/lib/import/letterboxd-export'
import { parseCsvRows } from '@/lib/import/csv'
import { parseImportFiles } from '@/lib/import/parse-file'
import { bytes } from './helpers'

/** Columnas que reconoce el importador de Letterboxd. */
const LETTERBOXD_IMPORT_COLUMNS = new Set([
  'LetterboxdURI', 'tmdbID', 'imdbID', 'Title', 'Year', 'Directors', 'WatchedDate', 'Rating', 'Rating10', 'Tags', 'Rewatch', 'Review',
])

const entries: ExportEntry[] = [
  { mediaId: 'movie_693134', status: 'completed', rating10: 9, watchedAt: '2024-05-01', title: 'Dune: Parte dos', year: 2024 },
  { mediaId: 'movie_550', status: 'completed', rating10: 7.5, watchedAt: null, title: 'El club de la lucha, "Fight Club"', year: 1999 },
  { mediaId: 'movie_12', status: 'pending', rating10: null, watchedAt: null, title: 'Buscando a Nemo', year: 2003 },
  { mediaId: 'tv_1396', status: 'completed', rating10: 10, watchedAt: null, title: 'Breaking Bad', year: 2008 },
  { mediaId: 'anime_1', status: 'completed', rating10: 9, watchedAt: null, title: 'Cowboy Bebop', year: 1998 },
]
const logs: ExportLog[] = [
  { mediaId: 'movie_693134', watchedOn: '2024-05-01', rewatch: true, rating10: 9, review: 'Mejor la segunda vez,\ncon "IMAX".' },
  { mediaId: 'movie_693134', watchedOn: '2024-03-01', rewatch: false, rating10: 8, review: null },
]

describe('exportación CSV para Letterboxd', () => {
  it('cabecera y valores en el formato de importación de Letterboxd', () => {
    const csv = buildLetterboxdCsv('watched', entries, logs)
    expect(csv.endsWith('\r\n')).toBe(true)
    const [header, ...rows] = parseCsvRows(csv)
    expect(header).toEqual(['tmdbID', 'Title', 'Year', 'Rating', 'WatchedDate', 'Rewatch', 'Review'])
    header.forEach((h) => expect(LETTERBOXD_IMPORT_COLUMNS.has(h)).toBe(true))

    // Solo películas; una fila por visionado, en orden de fecha.
    expect(rows.map((r) => r[0])).toEqual(['693134', '693134', '550'])
    for (const r of rows) {
      const rec = Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))
      expect(rec.tmdbID).toMatch(/^\d+$/)
      expect(rec.Year).toMatch(/^\d{4}$/)
      if (rec.Rating) {
        const stars = Number(rec.Rating)
        expect(stars).toBeGreaterThanOrEqual(0.5)
        expect(stars).toBeLessThanOrEqual(5)
        expect(Number.isInteger(stars * 2)).toBe(true)
      }
      if (rec.WatchedDate) expect(rec.WatchedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(['true', 'false']).toContain(rec.Rewatch)
    }
    expect(rows[0]).toEqual(['693134', 'Dune: Parte dos', '2024', '4', '2024-03-01', 'false', ''])
    expect(rows[1]).toEqual(['693134', 'Dune: Parte dos', '2024', '4.5', '2024-05-01', 'true', 'Mejor la segunda vez,\ncon "IMAX".'])
    // 7,5/10 → 4★ (Letterboxd solo tiene medias estrellas); comillas escapadas.
    expect(rows[2]).toEqual(['550', 'El club de la lucha, "Fight Club"', '1999', '4', '', 'false', ''])
  })

  it('watchlist: solo pendientes, sin nota ni fecha', () => {
    const [, ...rows] = parseCsvRows(buildLetterboxdCsv('watchlist', entries))
    expect(rows).toEqual([['12', 'Buscando a Nemo', '2003', '', '', '', '']])
  })

  it('KULTURA vuelve a leer su propia exportación por tmdbID (ida y vuelta)', async () => {
    const parsed = await parseImportFiles([{ name: 'kultura-letterboxd-watched.csv', bytes: bytes(buildLetterboxdCsv('watched', entries, logs)) }])
    expect(parsed.source).toBe('letterboxd')
    const dune = parsed.items.find((i) => i.ids?.tmdb === 693134)!
    expect(dune).toMatchObject({ status: 'completed', rating10: 9, watchedAt: '2024-05-01' })
    expect(dune.logs).toHaveLength(2)
    expect(parsed.items.find((i) => i.ids?.tmdb === 550)).toMatchObject({ rating10: 8 })
  })

  it('ayudantes', () => {
    expect(tmdbMovieId('movie_550')).toBe(550)
    expect(tmdbMovieId('tv_550')).toBeNull()
    expect(letterboxdStars(null)).toBe('')
    expect(letterboxdStars(1)).toBe('0.5')
    expect(letterboxdStars(10)).toBe('5')
  })
})
