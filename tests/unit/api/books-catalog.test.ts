// ============================================================
// KULTURA — Recolector de catálogo de libros (E-BOOKS-LANG)
//
// Cubre los tres síntomas que motivaron el recolector, que eran el mismo
// problema visto desde tres sitios:
//   1. Títulos en inglés con la app en español.
//   2. El filtro de año devolvía páginas en blanco.
//   3. Error al paginar hondo, porque `totalItems` promete más de lo que
//      Google sirve.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GoogleBooksVolume } from '@/lib/api/googlebooks'

const { windowMock } = vi.hoisted(() => ({ windowMock: vi.fn() }))

vi.mock('@/lib/api/googlebooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/googlebooks')>()
  return { ...actual, fetchGoogleBooksWindow: windowMock }
})

import { collectBooksPage, booksTotalPages, BOOKS_MAX_PAGES } from '@/lib/api/books-catalog'
import { GoogleBooksError } from '@/lib/api/googlebooks'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Volumen crudo tal y como lo sirve Google Books. */
function volume(id: string, language: string, year = 2020): GoogleBooksVolume {
  return {
    id,
    volumeInfo: {
      title: `${language.toUpperCase()} ${id}`,
      language,
      publishedDate: String(year),
    },
  } as GoogleBooksVolume
}

/** Una ventana de `n` volúmenes del idioma dado. */
function windowOf(n: number, language: string, year = 2020, prefix = 'v') {
  return Array.from({ length: n }, (_, i) => volume(`${prefix}${i}`, language, year))
}

function respond(items: GoogleBooksVolume[], totalItems = 500) {
  return { items, totalItems }
}

const BASE = { q: 'subject:fiction', params: {}, locale: 'es', lang: 'es' }

beforeEach(() => {
  windowMock.mockReset()
})

describe('collectBooksPage — idioma', () => {
  it('descarta las ediciones que no son del idioma pedido', async () => {
    windowMock.mockResolvedValueOnce(
      respond([...windowOf(20, 'es', 2020, 'es'), ...windowOf(20, 'en', 2020, 'en')])
    )

    const { items } = await collectBooksPage({ ...BASE, page: 1 })

    expect(items).toHaveLength(20)
    expect(items.every((i) => i.metadata?.language === 'es')).toBe(true)
  })

  it('barre una segunda ventana cuando la primera no llena la página', async () => {
    windowMock
      .mockResolvedValueOnce(respond([...windowOf(5, 'es', 2020, 'a'), ...windowOf(35, 'en', 2020, 'b')]))
      .mockResolvedValueOnce(respond(windowOf(40, 'es', 2020, 'c')))

    const { items } = await collectBooksPage({ ...BASE, page: 1 })

    expect(windowMock).toHaveBeenCalledTimes(2)
    expect(items).toHaveLength(20)
    expect(items.every((i) => i.metadata?.language === 'es')).toBe(true)
  })

  it('sin ninguna edición del idioma sirve las que haya: nunca rejilla en blanco', async () => {
    windowMock.mockResolvedValue(respond(windowOf(40, 'en')))

    const { items } = await collectBooksPage({ ...BASE, page: 1 })

    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.metadata?.language === 'en')).toBe(true)
  })
})

describe('collectBooksPage — año', () => {
  it('busca el año por todo el barrido, no solo en los 20 primeros', async () => {
    // Ninguno de los 40 primeros es de 2026; sí los de la segunda ventana.
    windowMock
      .mockResolvedValueOnce(respond(windowOf(40, 'es', 2001, 'viejo')))
      .mockResolvedValueOnce(respond(windowOf(40, 'es', 2026, 'nuevo')))

    const { items } = await collectBooksPage({
      ...BASE,
      page: 1,
      yearMatcher: (y) => y === 2026,
    })

    expect(items).toHaveLength(20)
    expect(items.every((i) => i.year === 2026)).toBe(true)
  })

  it('si de verdad no hay nada de ese año, devuelve vacío sin inventar', async () => {
    windowMock.mockResolvedValue(respond(windowOf(40, 'es', 1999)))

    const { items } = await collectBooksPage({
      ...BASE,
      page: 1,
      yearMatcher: (y) => y === 2026,
    })

    expect(items).toEqual([])
  })
})

describe('collectBooksPage — final del catálogo', () => {
  it('un 400 de Google es fin de lista, no un error para el usuario', async () => {
    windowMock.mockRejectedValue(new GoogleBooksError('/volumes', 400))

    const res = await collectBooksPage({ ...BASE, page: 1 })

    expect(res.items).toEqual([])
    expect(res.hasMore).toBe(false)
  })

  it('un 429 SÍ se propaga: es un fallo real que hay que enseñar', async () => {
    windowMock.mockRejectedValue(new GoogleBooksError('/volumes', 429))

    await expect(collectBooksPage({ ...BASE, page: 1 })).rejects.toMatchObject({
      status: 429,
    })
  })

  it('una ventana más corta que el máximo cierra la paginación', async () => {
    windowMock.mockResolvedValueOnce(respond(windowOf(12, 'es')))

    const res = await collectBooksPage({ ...BASE, page: 1 })

    expect(res.hasMore).toBe(false)
    expect(windowMock).toHaveBeenCalledTimes(1)
  })

  it('una ventana vacía cierra la paginación sin pedir la siguiente', async () => {
    windowMock.mockResolvedValueOnce(respond([]))

    const res = await collectBooksPage({ ...BASE, page: 1 })

    expect(res.items).toEqual([])
    expect(res.hasMore).toBe(false)
  })

  it('no pide al proveedor más allá de donde sirve', async () => {
    windowMock.mockResolvedValue(respond(windowOf(40, 'es')))

    const res = await collectBooksPage({ ...BASE, page: BOOKS_MAX_PAGES + 5 })

    expect(windowMock).not.toHaveBeenCalled()
    expect(res.hasMore).toBe(false)
  })

  it('las páginas avanzan por el catálogo en vez de repetir el principio', async () => {
    windowMock.mockResolvedValue(respond(windowOf(40, 'es')))

    await collectBooksPage({ ...BASE, page: 2 })

    const firstStart = windowMock.mock.calls[0][1]
    expect(firstStart).toBeGreaterThan(0)
  })
})

describe('booksTotalPages', () => {
  it('nunca ofrece más páginas de las que el proveedor sirve', () => {
    expect(booksTotalPages(999999)).toBe(BOOKS_MAX_PAGES)
  })

  it('un catálogo pequeño da las páginas que le corresponden', () => {
    expect(booksTotalPages(10)).toBe(1)
  })

  it('sin total conocido asume una página, no cero', () => {
    expect(booksTotalPages(undefined)).toBe(1)
    expect(booksTotalPages(0)).toBe(1)
  })
})
