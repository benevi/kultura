// ============================================================
// Generador del `ratings.csv` de aceptación de F-26 (500 filas) y del
// catálogo simulado de TMDB contra el que se empareja.
//
// El CSV tiene la forma exacta de Letterboxd (Date, Name, Year, Letterboxd
// URI, Rating; comillas solo donde hace falta; ½★). Está guardado en
// `letterboxd-ratings-500.csv` y un test comprueba que sigue siendo lo que
// sale de aquí.
//
// El catálogo imita lo que hace difícil emparejar en la vida real:
//   - remakes y secuelas con el mismo título (señuelos que NO deben ganar),
//   - el año de TMDB un año después (estreno en festival),
//   - signos distintos (– frente a -, acentos, & frente a and),
//   - títulos que en TMDB se llaman de otra manera,
//   - y alguna película que la búsqueda ni encuentra.
// ============================================================

import { csvCell } from '@/lib/import/csv'
import { titleSimilarity } from '@/lib/import/title-match'
import { prng } from '../helpers'
import { FILMS } from './films'

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function buildRatingsCsv(seed = 26): string {
  const rand = prng(seed)
  const lines = ['Date,Name,Year,Letterboxd URI,Rating']
  FILMS.forEach(([title, year]) => {
    const d = new Date(Date.UTC(2019, 0, 1) + Math.floor(rand() * 6 * 365) * 86_400_000).toISOString().slice(0, 10)
    const uri = `https://boxd.it/${Array.from({ length: 4 }, () => B62[Math.floor(rand() * 62)]).join('')}`
    // Notas sesgadas hacia arriba, como en Letterboxd (½★ incluidas).
    const rating = Math.max(0.5, Math.min(5, Math.round((2.5 + rand() * 2.5 + (rand() < 0.15 ? -2 : 0)) * 2) / 2))
    lines.push([d, title, year, uri, rating].map(csvCell).join(','))
  })
  return lines.join('\n') + '\n'
}

export interface CatalogMovie {
  id: number
  title: string
  original_title: string
  release_date: string
  /** Índice de la fila del CSV que ES esta película (los señuelos no tienen). */
  row?: number
}

const plain = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/–/g, '-').replace(/&/g, 'and')

export interface Catalog {
  movies: CatalogMovie[]
  /** id correcto de cada fila (o null si la película no está en el catálogo). */
  expected: Array<number | null>
}

export function buildCatalog(): Catalog {
  const movies: CatalogMovie[] = []
  const expected: Array<number | null> = []
  let decoyId = 900_000
  FILMS.forEach(([title, year], i) => {
    const id = 10_000 + i
    if (i % 100 === 42) {
      // La búsqueda no la encuentra (solo hay un señuelo de otro año).
      expected.push(null)
      movies.push({ id: decoyId++, title, original_title: title, release_date: `${year - 30}-01-01` })
      return
    }
    let t = title
    let y = year
    if (i % 33 === 5) y = year + 1
    if (i % 40 === 13) t = plain(title)
    if (i % 25 === 7) t = `${title.split(/[:(]/)[0].trim()} Redux`
    expected.push(id)
    movies.push({ id, title: t, original_title: t, release_date: `${y}-06-15`, row: i })
    if (i % 10 === 3) {
      movies.push({ id: decoyId++, title, original_title: title, release_date: `${year - 15}-03-01` })
      movies.push({ id: decoyId++, title: `${title} 2`, original_title: `${title} 2`, release_date: `${year + 3}-03-01` })
    }
  })
  return { movies, expected }
}

/**
 * `/search/movie` simulado: lo que se parece a la consulta, por parecido y
 * hasta 20 resultados (como una página de TMDB), con la forma de sus listados.
 */
export function searchCatalog(catalog: CatalogMovie[], query: string) {
  const results = catalog
    .map((m) => ({ m, s: titleSimilarity(query, m.title) }))
    .filter(({ s }) => s >= 0.35)
    .sort((a, b) => b.s - a.s || a.m.id - b.m.id)
    .slice(0, 20)
    .map(({ m }) => ({
      adult: false,
      backdrop_path: null,
      genre_ids: [18],
      genres: [{ id: 18, name: 'Drama' }],
      id: m.id,
      original_language: 'en',
      original_title: m.original_title,
      overview: '',
      popularity: 1,
      poster_path: `/p${m.id}.jpg`,
      release_date: m.release_date,
      title: m.title,
      video: false,
      vote_average: 7,
      vote_count: 10,
    }))
  return { page: 1, results, total_pages: 1, total_results: results.length }
}
