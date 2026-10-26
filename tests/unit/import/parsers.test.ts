// @vitest-environment node
// F-26 — Lectores de cada app con archivos con la forma documentada por cada
// una (columnas reales, ZIP de Letterboxd, XML de MAL, CSV de Goodreads…).
import { describe, it, expect } from 'vitest'
import { parseImportFiles, summarizeImport } from '@/lib/import/parse-file'
import { ImportParseError } from '@/lib/import/types'
import { MAX_FILE_BYTES, MAX_IMPORT_ITEMS } from '@/lib/import/limits'
import { bytes, gz, makeZip } from './helpers'

const LB_RATINGS = `Date,Name,Year,Letterboxd URI,Rating
2023-01-04,Dune,2021,https://boxd.it/qMgS,4.5
2023-01-05,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/1Y0w,5
2023-02-11,Halloween,1978,https://boxd.it/1RCk,3.5
2023-02-12,Amélie,2001,https://boxd.it/1Y5o,0.5
`
const LB_DIARY = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2023-01-04,Dune,2021,https://boxd.it/aaa1,4,,cine,2021-10-01
2023-01-04,Dune,2021,https://boxd.it/aaa2,4.5,Yes,,2022-03-02
2023-03-01,Parasite,2019,https://boxd.it/aaa3,5,,,2023-02-28
`
const LB_REVIEWS = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date
2023-03-01,Parasite,2019,https://boxd.it/aaa3,5,,"Obra maestra, sin más.",,2023-02-28
`
const LB_WATCHLIST = `Date,Name,Year,Letterboxd URI
2023-05-01,Perfect Days,2023,https://boxd.it/zzz1
2023-05-02,Dune,2021,https://boxd.it/qMgS
`
const LB_DELETED = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2020-01-01,Cats,2019,https://boxd.it/del1,0.5,,,2020-01-01
`

describe('Letterboxd', () => {
  it('ZIP de exportación: junta notas, diario, reseñas y pendientes; ignora deleted/ y lists/', async () => {
    const zip = makeZip([
      { name: 'ratings.csv', content: LB_RATINGS },
      { name: 'diary.csv', content: LB_DIARY },
      { name: 'reviews.csv', content: LB_REVIEWS },
      { name: 'watchlist.csv', content: LB_WATCHLIST, store: true },
      { name: 'deleted/diary.csv', content: LB_DELETED },
      { name: 'lists/favoritas.csv', content: 'Letterboxd list export v7\nDate,Name\n' },
      { name: 'profile.csv', content: 'Date Joined,Username\n2020-01-01,secreto\n' },
    ])
    const parsed = await parseImportFiles([{ name: 'letterboxd-user-2026.zip', bytes: zip }])
    expect(parsed.source).toBe('letterboxd')
    const byTitle = new Map(parsed.items.map((i) => [i.title, i]))
    expect(byTitle.has('Cats')).toBe(false)

    const dune = byTitle.get('Dune')!
    // Nota actual de ratings.csv (½★ sin pérdida), vista aunque esté en pendientes.
    expect(dune).toMatchObject({ kind: 'movie', year: 2021, status: 'completed', rating10: 9, watchedAt: '2022-03-02' })
    expect(dune.logs).toEqual([
      { watchedOn: '2022-03-02', rewatch: true, rating10: 9, review: null, spoiler: false },
      { watchedOn: '2021-10-01', rewatch: false, rating10: 8, review: null, spoiler: false },
    ])
    expect(byTitle.get('Crouching Tiger, Hidden Dragon')).toMatchObject({ rating10: 10, status: 'completed' })
    expect(byTitle.get('Amélie')).toMatchObject({ rating10: 1 })
    // La reseña se cuelga del apunte de su fecha (no se duplica).
    expect(byTitle.get('Parasite')!.logs).toEqual([
      { watchedOn: '2023-02-28', rewatch: false, rating10: 10, review: 'Obra maestra, sin más.', spoiler: false },
    ])
    expect(byTitle.get('Parasite')!.rating10).toBe(10)
    expect(byTitle.get('Perfect Days')).toMatchObject({ status: 'pending', rating10: null, watchedAt: null })
    // Nada del perfil (nombre de usuario) viaja en las filas.
    expect(JSON.stringify(parsed.items)).not.toContain('secreto')
    expect(parsed.items.every((i, n) => i.key === String(n))).toBe(true)
  })

  it('CSV sueltos con nombre y en otro orden de columnas', async () => {
    const reordered = 'Rating,Letterboxd URI,Year,Name,Date\n2.5,https://boxd.it/1,1999,The Matrix,2024-01-01\n'
    const parsed = await parseImportFiles([
      { name: 'ratings.csv', bytes: bytes('﻿' + reordered) },
      { name: 'watchlist.csv', bytes: bytes(LB_WATCHLIST) },
    ])
    expect(parsed.items.find((i) => i.title === 'The Matrix')).toMatchObject({ year: 1999, rating10: 5, status: 'completed' })
    expect(parsed.items.find((i) => i.title === 'Perfect Days')).toMatchObject({ status: 'pending' })
  })

  it('un CSV sin nombre que diga si es vistas o pendientes: aviso y opción', async () => {
    const plain = 'Date,Name,Year,Letterboxd URI\n2023-05-01,Perfect Days,2023,https://boxd.it/zzz1\n'
    const asWatched = await parseImportFiles([{ name: 'export.csv', bytes: bytes(plain) }])
    expect(asWatched.warnings).toContainEqual({ code: 'ambiguous_list' })
    expect(asWatched.items[0].status).toBe('completed')
    const asWatchlist = await parseImportFiles([{ name: 'export.csv', bytes: bytes(plain) }], {
      letterboxd: { ambiguousAs: 'watchlist' },
    })
    expect(asWatchlist.items[0].status).toBe('pending')
  })

  it('formato de importación de Letterboxd (el que exporta KULTURA): tmdbID, Rating10, WatchedDate', async () => {
    const csv = 'tmdbID,Title,Year,Rating10,WatchedDate,Rewatch,Review\n438631,Dune,2021,9,2021-10-01,false,"Arena, mucha arena"\n550,,,,,,\n'
    const parsed = await parseImportFiles([{ name: 'kultura-letterboxd-watched.csv', bytes: bytes(csv) }])
    expect(parsed.source).toBe('letterboxd')
    expect(parsed.items[0]).toMatchObject({ ids: { tmdb: 438631 }, rating10: 9, status: 'completed', watchedAt: '2021-10-01' })
    expect(parsed.items[0].logs?.[0].review).toBe('Arena, mucha arena')
    expect(parsed.items[1]).toMatchObject({ ids: { tmdb: 550 }, status: 'completed' })
  })

  it('notas que no son de Letterboxd no se inventan; filas sin título se cuentan', async () => {
    const csv = 'Date,Name,Year,Letterboxd URI,Rating\n2023-01-01,A,2000,u,7\n2023-01-01,,2000,u,3\n'
    const parsed = await parseImportFiles([{ name: 'ratings.csv', bytes: bytes(csv) }])
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0].rating10).toBeNull()
    expect(parsed.warnings).toContainEqual({ code: 'skipped_rows', count: 1 })
  })
})

const MAL_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_id>123</user_id><user_name>nombre_privado</user_name><user_export_type>1</user_export_type></myinfo>
  <anime>
    <series_animedb_id>1</series_animedb_id>
    <series_title><![CDATA[Cowboy Bebop]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>26</series_episodes>
    <my_watched_episodes>26</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>2020-04-05</my_finish_date>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
    <my_times_watched>1</my_times_watched>
    <my_comments><![CDATA[comentario privado]]></my_comments>
  </anime>
  <anime>
    <series_animedb_id>5114</series_animedb_id>
    <series_title>Fullmetal Alchemist: Brotherhood &amp; Co</series_title>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>0</my_score>
    <my_status>Plan to Watch</my_status>
  </anime>
  <anime>
    <series_animedb_id>21</series_animedb_id>
    <series_title><![CDATA[One Piece]]></series_title>
    <my_score>8</my_score>
    <my_status>3</my_status>
  </anime>
  <anime>
    <series_animedb_id>0</series_animedb_id>
    <series_title>Sin id</series_title>
    <my_status>Completed</my_status>
  </anime>
</myanimelist>`

describe('MyAnimeList', () => {
  it('XML de anime: estados (texto y número), notas /10, fechas 0000-00-00 y CDATA', async () => {
    const parsed = await parseImportFiles([{ name: 'animelist_1700000000_-_123.xml', bytes: bytes(MAL_XML) }])
    expect(parsed.source).toBe('mal')
    expect(parsed.items).toHaveLength(3)
    expect(parsed.items[0]).toMatchObject({
      kind: 'anime',
      title: 'Cowboy Bebop',
      ids: { mal: 1 },
      status: 'completed',
      rating10: 9,
      watchedAt: '2020-04-05',
    })
    expect(parsed.items[1]).toMatchObject({ title: 'Fullmetal Alchemist: Brotherhood & Co', status: 'pending', rating10: null })
    expect(parsed.items[2]).toMatchObject({ ids: { mal: 21 }, status: 'in_progress', rating10: 8 })
    expect(parsed.warnings).toContainEqual({ code: 'skipped_rows', count: 1 })
    const wire = JSON.stringify(parsed.items)
    expect(wire).not.toContain('nombre_privado')
    expect(wire).not.toContain('comentario privado')
  })

  it('.xml.gz de manga', async () => {
    const xml = `<myanimelist><manga><manga_mangadb_id>2</manga_mangadb_id><manga_title><![CDATA[Berserk]]></manga_title>
      <my_read_chapters>364</my_read_chapters><my_score>10</my_score><my_status>Reading</my_status></manga></myanimelist>`
    const parsed = await parseImportFiles([{ name: 'mangalist.xml.gz', bytes: gz(xml) }])
    expect(parsed.items[0]).toMatchObject({ kind: 'manga', ids: { mal: 2 }, status: 'in_progress', rating10: 10 })
  })
})

describe('Goodreads', () => {
  const header =
    'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies'
  const rows = [
    '2767052,"The Hunger Games (The Hunger Games, #1)",Suzanne Collins,"Collins, Suzanne",,"=""0439023483""","=""9780439023481""",4,4.33,Scholastic Press,Hardcover,374,2008,2008,2019/03/02,2018/01/01,,,read,"Me <b>encantó</b>.<br/>Mucho.",,nota privada,2,0',
    '44767458,Dune,Frank Herbert,"Herbert, Frank",,"=""""","=""""",0,4.27,Ace,Paperback,658,2005,1965,,2020/02/02,to-read,to-read (#1),to-read,,,,0,0',
    '1,Libro dejado,Autora X,"X, Autora",,,,2,3.1,,,,2010,2010,,2021/01/01,dnf,,dnf,,,,1,0',
    '2,Leyendo,Autor Y,"Y, Autor",,,,0,3.1,,,,2010,2010,,2021/01/01,currently-reading,,currently-reading,,,,1,0',
  ]
  it('estanterías, ISBN con forma de fórmula, nota ×2, sufijo de serie, reseña en HTML', async () => {
    const parsed = await parseImportFiles([{ name: 'goodreads_library_export.csv', bytes: bytes([header, ...rows].join('\n')) }])
    expect(parsed.source).toBe('goodreads')
    const [hg, dune, dnf, reading] = parsed.items
    expect(hg).toMatchObject({
      kind: 'book',
      title: 'The Hunger Games',
      author: 'Suzanne Collins',
      year: 2008,
      ids: { isbn: ['9780439023481', '0439023483'] },
      status: 'completed',
      rating10: 8,
      watchedAt: '2019-03-02',
    })
    expect(hg.logs).toEqual([{ watchedOn: '2019-03-02', rewatch: true, rating10: 8, review: 'Me encantó.\nMucho.', spoiler: false }])
    expect(dune).toMatchObject({ title: 'Dune', year: 1965, status: 'pending', rating10: null })
    expect(dune.ids).toBeUndefined()
    expect(dnf.status).toBe('abandoned')
    expect(reading.status).toBe('in_progress')
    expect(JSON.stringify(parsed.items)).not.toContain('nota privada')
  })
})

describe('IMDb', () => {
  it('ratings: id tt…, tipos de título y episodios fuera', async () => {
    const csv = `Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
tt0133093,9,2020-01-01,The Matrix,The Matrix,https://www.imdb.com/title/tt0133093/,Movie,8.7,136,1999,"Action, Sci-Fi",2000000,1999-03-24,"Lana Wachowski, Lilly Wachowski"
tt0903747,10,2020-01-02,Breaking Bad,Breaking Bad,https://www.imdb.com/title/tt0903747/,TV Series,9.5,49,2008,Drama,2000000,2008-01-20,
tt0959621,8,2020-01-03,Pilot,Pilot,https://www.imdb.com/title/tt0959621/,TV Episode,9.0,58,2008,Drama,1000,2008-01-20,
`
    const parsed = await parseImportFiles([{ name: 'ratings.csv', bytes: bytes(csv) }])
    expect(parsed.source).toBe('imdb')
    expect(parsed.items).toEqual([
      expect.objectContaining({ kind: 'movie', ids: { imdb: 'tt0133093' }, rating10: 9, status: 'completed', year: 1999 }),
      expect.objectContaining({ kind: 'tv', ids: { imdb: 'tt0903747' }, rating10: 10 }),
    ])
  })

  it('watchlist → pendientes', async () => {
    const csv = 'Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated\n1,tt15239678,2024-01-01,,,Dune: Part Two,,,Movie,8.5,166,2024,,,,,,\n'
    const parsed = await parseImportFiles([{ name: 'WATCHLIST.csv', bytes: bytes(csv) }])
    expect(parsed.items[0]).toMatchObject({ status: 'pending', ids: { imdb: 'tt15239678' } })
  })
})

describe('TV Time (beta)', () => {
  it('ZIP RGPD: series seguidas y episodios vistos se agrupan por id de TVDB', async () => {
    const zip = makeZip([
      { name: 'followed_tv_show.csv', content: 'tv_show_id,tv_show_name,created_at,active\n81189,Breaking Bad,2019-01-01 10:00:00,1\n' },
      {
        name: 'seen_episode.csv',
        content:
          'episode_id,tv_show_id,tv_show_name,episode_season_number,episode_number,created_at\n1,81189,Breaking Bad,1,1,2019-01-02\n2,81189,Breaking Bad,1,2,2019-01-03\n3,121361,Game of Thrones,1,1,2019-02-01\n',
      },
      { name: 'user.csv', content: 'id,email\n1,privado@example.com\n' },
    ])
    const parsed = await parseImportFiles([{ name: 'tvtime-gdpr.zip', bytes: zip }])
    expect(parsed.source).toBe('tvtime')
    expect(parsed.items).toEqual([
      expect.objectContaining({ kind: 'tv', title: 'Breaking Bad', ids: { tvdb: 81189 }, status: 'in_progress' }),
      expect.objectContaining({ kind: 'tv', title: 'Game of Thrones', ids: { tvdb: 121361 } }),
    ])
    expect(JSON.stringify(parsed.items)).not.toContain('privado@example.com')
  })
})

describe('detección y límites', () => {
  it('formato desconocido, vacío y fuentes mezcladas', async () => {
    await expect(parseImportFiles([{ name: 'x.csv', bytes: bytes('foo,bar\n1,2\n') }])).rejects.toMatchObject({ code: 'unknown_format' })
    await expect(parseImportFiles([{ name: 'x.csv', bytes: new Uint8Array() }])).rejects.toMatchObject({ code: 'empty' })
    await expect(
      parseImportFiles([
        { name: 'ratings.csv', bytes: bytes(LB_RATINGS) },
        { name: 'animelist.xml', bytes: bytes(MAL_XML) },
      ])
    ).rejects.toBeInstanceOf(ImportParseError)
  })

  it('archivo demasiado grande', async () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1)
    await expect(parseImportFiles([{ name: 'ratings.csv', bytes: big }])).rejects.toMatchObject({ code: 'too_large' })
  })

  it('ZIP dañado', async () => {
    const zip = makeZip([{ name: 'ratings.csv', content: LB_RATINGS }])
    await expect(parseImportFiles([{ name: 'a.zip', bytes: zip.slice(0, zip.length - 30) }])).rejects.toMatchObject({ code: 'corrupt' })
  })

  it(`más de ${MAX_IMPORT_ITEMS} títulos: se corta con aviso y primero lo visto`, async () => {
    const lines = ['Date,Name,Year,Letterboxd URI,Rating']
    for (let i = 0; i < MAX_IMPORT_ITEMS + 5; i++) lines.push(`2024-01-01,Film ${i},2000,u,${i % 2 ? '3' : ''}`)
    const parsed = await parseImportFiles([{ name: 'ratings.csv', bytes: bytes(lines.join('\n')) }])
    expect(parsed.items).toHaveLength(MAX_IMPORT_ITEMS)
    expect(parsed.warnings).toContainEqual({ code: 'truncated', count: 5, max: MAX_IMPORT_ITEMS })
    expect(parsed.items[0].rating10).not.toBeNull()
  })

  it('resumen para la vista previa', async () => {
    const parsed = await parseImportFiles([
      { name: 'ratings.csv', bytes: bytes(LB_RATINGS) },
      { name: 'diary.csv', bytes: bytes(LB_DIARY) },
      { name: 'watchlist.csv', bytes: bytes(LB_WATCHLIST) },
    ])
    const s = summarizeImport(parsed.items)
    expect(s.total).toBe(6)
    expect(s.byStatus.completed).toBe(5)
    expect(s.byStatus.pending).toBe(1)
    expect(s.byKind.movie).toBe(6)
    expect(s.logs).toBe(3)
  })
})
