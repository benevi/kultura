// ============================================================
// KULTURA — E-MATCH-VOCAB: vocabulario canónico de géneros
//
// Sin esta capa, el perfil de gustos comparaba cadenas crudas de cada
// proveedor: una biblioteca de cine en español no podía puntuar nunca un anime
// o un juego, y cambiar el idioma de la app partía el perfil en dos.
// ============================================================

import { describe, it, expect } from 'vitest'
import { canonicalGenres } from '@/lib/recommendations/genre-canonical'

describe('canonicalGenres', () => {
  it('vacío o ausente → []', () => {
    expect(canonicalGenres(undefined)).toEqual([])
    expect(canonicalGenres(null)).toEqual([])
    expect(canonicalGenres([])).toEqual([])
  })

  it('TMDB en español y en inglés dan el MISMO slug', () => {
    expect(canonicalGenres(['Acción'])).toEqual(canonicalGenres(['Action']))
    expect(canonicalGenres(['Ciencia ficción'])).toEqual(canonicalGenres(['Science Fiction']))
    expect(canonicalGenres(['Animación'])).toEqual(['animacion'])
  })

  it('cruza proveedores: TMDB, AniList y RAWG convergen en el mismo slug', () => {
    // "Acción" (TMDB es) · "Action" (AniList/MangaDex) · "Action" (RAWG)
    expect(canonicalGenres(['Acción'])).toEqual(['accion'])
    expect(canonicalGenres(['Action'])).toEqual(['accion'])
  })

  it('AniList: Sci-Fi, Slice of Life, Supernatural y Thriller', () => {
    expect(canonicalGenres(['Sci-Fi'])).toEqual(['ciencia-ficcion'])
    expect(canonicalGenres(['Slice of Life'])).toEqual(['recuentos-de-la-vida'])
    expect(canonicalGenres(['Supernatural'])).toEqual(['sobrenatural'])
    // AniList no distingue Suspense de Thriller (ver ANILIST_GENRE).
    expect(canonicalGenres(['Thriller'])).toEqual(['suspense'])
  })

  it('RAWG: nombres propios de videojuego', () => {
    expect(canonicalGenres(['Platformer'])).toEqual(['plataformas'])
    expect(canonicalGenres(['RPG'])).toEqual(['rpg'])
    expect(canonicalGenres(['Racing'])).toEqual(['carreras'])
    expect(canonicalGenres(['Fighting'])).toEqual(['lucha'])
  })

  it('TMDB televisión: los géneros combinados se expanden a sus componentes', () => {
    // Así una serie de acción puede puntuar contra una película de acción.
    expect(canonicalGenres(['Action & Adventure'])).toEqual(['accion', 'aventura'])
    expect(canonicalGenres(['Sci-Fi & Fantasy'])).toEqual(['ciencia-ficcion', 'fantasia'])
    expect(canonicalGenres(['Acción y Aventura'])).toEqual(['accion', 'aventura'])
    expect(canonicalGenres(['War & Politics'])).toEqual(['belica'])
  })

  it('Google Books: resuelve la jerarquía BISAC separada por barras', () => {
    expect(canonicalGenres(['Fiction / Science Fiction / General'])).toEqual(['ciencia-ficcion'])
    expect(canonicalGenres(['Juvenile Fiction'])).toEqual(['infantil'])
    expect(canonicalGenres(['Biography & Autobiography'])).toEqual(['biografia'])
  })

  it('sin coincidencia en el vocabulario → se descarta, no se inventa slug', () => {
    expect(canonicalGenres(['Mecha'])).toEqual([])
    expect(canonicalGenres(['Fiction / Literary'])).toEqual([])
    expect(canonicalGenres(['Board Games'])).toEqual([])
  })

  it('deduplica cuando varios nombres caen en el mismo slug', () => {
    expect(canonicalGenres(['Action', 'Acción', 'Action & Adventure'])).toEqual([
      'accion',
      'aventura',
    ])
  })

  it('tolera mayúsculas, acentos y espacios de sobra', () => {
    expect(canonicalGenres(['  ACCIÓN  '])).toEqual(['accion'])
    expect(canonicalGenres(['Ciencia  Ficción'])).toEqual(['ciencia-ficcion'])
  })

  it('ignora entradas que no son texto sin romper el resto', () => {
    expect(canonicalGenres([null as unknown as string, 'Drama'])).toEqual(['drama'])
  })
})
