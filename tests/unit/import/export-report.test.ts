// @vitest-environment node
// F-26 — Exportación CSV compatible con Letterboxd (y que KULTURA vuelve a
// importar), informe descargable y lector de ZIP frente a archivos hostiles.
import { describe, it, expect } from 'vitest'
import { buildLetterboxdCsv, LETTERBOXD_EXPORT_HEADERS } from '@/lib/import/letterboxd-export'
import { buildReportCsv, mediaPath, spreadsheetSafe, type ReportLabels } from '@/lib/import/report'
import { parseCsvTable } from '@/lib/import/csv'
import { parseImportFiles } from '@/lib/import/parse-file'
import { readZip } from '@/lib/import/archive'
import { parseImportBatch, parseImportItem } from '@/lib/import/validate'
import { bytes, makeZip } from './helpers'

const entries = [
  { mediaId: 'movie_438631', status: 'completed', rating10: 9, watchedAt: '2021-10-01', title: 'Dune', year: 2021 },
  { mediaId: 'movie_550', status: 'completed', rating10: null, watchedAt: null, title: 'Fight Club', year: 1999 },
  { mediaId: 'movie_1', status: 'pending', rating10: null, watchedAt: null, title: 'Pendiente, con coma', year: 2024 },
  { mediaId: 'tv_1396', status: 'completed', rating10: 10, watchedAt: null, title: 'Breaking Bad', year: 2008 },
  { mediaId: 'movie_2', status: 'abandoned', rating10: 3, watchedAt: null, title: 'Dejada', year: 2010 },
]
const logs = [
  { mediaId: 'movie_438631', watchedOn: '2024-03-01', rewatch: true, rating10: 10, review: 'Mejor la segunda vez' },
  { mediaId: 'movie_438631', watchedOn: '2021-10-01', rewatch: false, rating10: null, review: null },
]

describe('buildLetterboxdCsv', () => {
  it('formato de importación de Letterboxd: tmdbID, ½★, WatchedDate, Rewatch, Review; solo películas', () => {
    const csv = buildLetterboxdCsv('watched', entries, logs)
    const table = parseCsvTable(csv)
    expect(csv.split('\r\n')[0]).toBe(LETTERBOXD_EXPORT_HEADERS.join(','))
    expect(table.records).toEqual([
      { tmdbid: '438631', title: 'Dune', year: '2021', rating: '4.5', watcheddate: '2021-10-01', rewatch: 'false', review: '' },
      { tmdbid: '438631', title: 'Dune', year: '2021', rating: '5', watcheddate: '2024-03-01', rewatch: 'true', review: 'Mejor la segunda vez' },
      { tmdbid: '550', title: 'Fight Club', year: '1999', rating: '', watcheddate: '', rewatch: 'false', review: '' },
    ])
  })

  it('neutraliza fórmulas de hoja de cálculo en Title y Review (=, +, -, @, tab, CR) y KULTURA las recupera al reimportar', async () => {
    const evil = [{ mediaId: 'movie_7', status: 'completed', rating10: 8, watchedAt: '2020-01-01', title: '=HYPERLINK("http://x")', year: 2020 }]
    const evilLogs = [
      { mediaId: 'movie_7', watchedOn: '2020-01-01', rewatch: false, rating10: 8, review: '+cmd|calc' },
      { mediaId: 'movie_7', watchedOn: '2021-01-01', rewatch: true, rating10: 8, review: '@SUM(1)' },
      { mediaId: 'movie_7', watchedOn: '2022-01-01', rewatch: true, rating10: 8, review: '-2+3' },
      { mediaId: 'movie_7', watchedOn: '2023-01-01', rewatch: true, rating10: 8, review: '\tx' },
      { mediaId: 'movie_7', watchedOn: '2024-01-01', rewatch: true, rating10: 8, review: '\rx' },
    ]
    const csv = buildLetterboxdCsv('watched', evil, evilLogs)
    const records = parseCsvTable(csv).records
    expect(records.map((r) => r.title)).toEqual(Array(5).fill(`'=HYPERLINK("http://x")`))
    expect(records.map((r) => r.review)).toEqual(["'+cmd|calc", "'@SUM(1)", "'-2+3", "'\tx", "'\rx"].map((v) => v.trim()))
    expect(records.every((r) => !/^[=+\-@\t\r]/.test(r.title) && !/^[=+\-@\t\r]/.test(r.review))).toBe(true)
    expect(parseCsvTable(buildLetterboxdCsv('watchlist', [{ ...evil[0], status: 'pending' }])).records[0].title).toBe(`'=HYPERLINK("http://x")`)

    const back = await parseImportFiles([{ name: 'kultura-letterboxd-watched.csv', bytes: bytes(csv) }])
    expect(back.items[0]).toMatchObject({ ids: { tmdb: 7 }, title: '=HYPERLINK("http://x")' })
    expect(back.items[0].logs?.map((l) => l.review)).toContain('+cmd|calc')
  })

  it('pendientes → watchlist', () => {
    const table = parseCsvTable(buildLetterboxdCsv('watchlist', entries))
    expect(table.records).toEqual([
      { tmdbid: '1', title: 'Pendiente, con coma', year: '2024', rating: '', watcheddate: '', rewatch: '', review: '' },
    ])
  })

  it('ida y vuelta: KULTURA vuelve a importar su propio CSV por tmdbID', async () => {
    const parsed = await parseImportFiles([{ name: 'kultura-letterboxd-watched-2026-10-26.csv', bytes: bytes(buildLetterboxdCsv('watched', entries, logs)) }])
    expect(parsed.source).toBe('letterboxd')
    const dune = parsed.items.find((i) => i.ids?.tmdb === 438631)!
    expect(dune).toMatchObject({ status: 'completed', rating10: 10, watchedAt: '2024-03-01' })
    expect(dune.logs).toHaveLength(2)
    expect(parsed.items.find((i) => i.ids?.tmdb === 550)).toMatchObject({ status: 'completed' })
  })
})

describe('informe', () => {
  const labels: ReportLabels = {
    headers: { title: 'Título', year: 'Año', result: 'Resultado', matchedTitle: 'En KULTURA', matchedYear: 'Año K', method: 'Por', link: 'Enlace' },
    outcomes: { added: 'Añadido', updated: 'Completado', kept: 'Ya estaba', unmatched: 'Sin emparejar', excluded: 'Fuera', pending: 'Pendiente', invalid: 'No válido' },
    methods: { tmdb: 'TMDB', imdb: 'IMDb', tvdb: 'TVDB', mal: 'MAL', isbn: 'ISBN', title_year: 'título y año', title: 'título' },
  }

  it('primero lo que hay que revisar; enlaces a la ficha; BOM; sin inyección de fórmulas', () => {
    const items = [
      { key: '0', kind: 'movie' as const, title: 'Dune', year: 2021, status: 'completed' as const, rating10: 9, watchedAt: null },
      { key: '1', kind: 'movie' as const, title: '=HYPERLINK("http://evil")', status: 'completed' as const, rating10: null, watchedAt: null },
    ]
    const results = new Map([
      ['0', { key: '0', outcome: 'added' as const, mediaId: 'movie_438631', title: 'Dune', year: 2021, by: 'title_year' as const }],
      ['1', { key: '1', outcome: 'unmatched' as const }],
    ])
    const csv = buildReportCsv(items, results, labels, 'https://kulturaapp.vercel.app', 'es')
    expect(csv.startsWith('﻿')).toBe(true)
    const table = parseCsvTable(csv)
    expect(table.records[0]).toMatchObject({ titulo: `'=HYPERLINK("http://evil")`, resultado: 'Sin emparejar' })
    expect(table.records[1]).toMatchObject({
      titulo: 'Dune',
      resultado: 'Añadido',
      'en kultura': 'Dune',
      por: 'título y año',
      enlace: 'https://kulturaapp.vercel.app/es/media/movie/438631',
    })
  })

  it('utilidades', () => {
    expect(spreadsheetSafe('+1')).toBe("'+1")
    expect(spreadsheetSafe('Normal')).toBe('Normal')
    expect(mediaPath('en', 'anime_al-1')).toBe('/en/media/anime/al-1')
  })
})

describe('ZIP hostil', () => {
  it('bomba de descompresión: se corta al pasar el límite', async () => {
    const zip = makeZip([{ name: 'ratings.csv', content: 'a'.repeat(2_000_000) }])
    expect(zip.length).toBeLessThan(10_000)
    await expect(readZip(zip, () => true, 1_000_000)).rejects.toMatchObject({ code: 'too_large' })
  })

  it('solo se descomprime lo pedido', async () => {
    const zip = makeZip([
      { name: 'ratings.csv', content: 'x' },
      { name: 'foto.jpg', content: 'y' },
    ])
    const out = await readZip(zip, (n) => n.endsWith('.csv'))
    expect(out.map((e) => e.name)).toEqual(['ratings.csv'])
  })
})

describe('validación del servidor', () => {
  it('descarta lo que no es seguro o no cabe', () => {
    expect(parseImportItem({ key: '0', kind: 'game', title: 'X', status: 'completed' })).toBeNull()
    expect(parseImportItem({ key: '../x', kind: 'movie', title: 'X', status: 'completed' })).toBeNull()
    expect(parseImportItem({ key: '0', kind: 'movie', title: 'x'.repeat(301), status: 'completed' })).toBeNull()
    expect(parseImportItem({ key: '0', kind: 'movie', title: 'X', status: 'watching' })).toBeNull()
    const ok = parseImportItem({
      key: '0',
      kind: 'movie',
      title: ' X ',
      status: 'completed',
      rating10: 9.25,
      watchedAt: '2999-01-01',
      year: 1700,
      ids: { imdb: 'tt1; DROP', tmdb: -1, isbn: ['978-0', '9780439023481'] },
      logs: [{ watchedOn: 'ayer' }, { watchedOn: '2020-01-01', review: 'r'.repeat(6000), rating10: 11 }],
    })
    expect(ok).toEqual({
      key: '0',
      kind: 'movie',
      title: 'X',
      status: 'completed',
      rating10: null,
      watchedAt: null,
      ids: { isbn: ['9780439023481'] },
      logs: [{ watchedOn: '2020-01-01', rewatch: false, rating10: null, review: 'r'.repeat(5000), spoiler: false }],
    })
  })

  it('lote: fuente, tamaño y claves repetidas', () => {
    expect(parseImportBatch({ source: 'trakt', items: [{}] })).toMatchObject({ ok: false })
    expect(parseImportBatch({ source: 'mal', items: [] })).toMatchObject({ ok: false })
    const parsed = parseImportBatch({
      source: 'mal',
      items: [
        { key: '1', kind: 'anime', title: 'A', status: 'pending', ids: { mal: 1 } },
        { key: '1', kind: 'anime', title: 'A bis', status: 'pending' },
        { key: '2', kind: 'anime', title: '', status: 'pending' },
      ],
    })
    expect(parsed).toMatchObject({ ok: true, invalidKeys: ['2'] })
    expect(parsed.ok && parsed.items.map((i) => i.title)).toEqual(['A'])
  })
})
