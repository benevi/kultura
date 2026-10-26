// @vitest-environment node
// F-26 — Emparejar por título + año sin emparejar MAL (PRO-3, riesgo medio).
import { describe, it, expect } from 'vitest'
import { authorKey, normalizeTitle, pickTitleMatch, stripSeriesSuffix, titleSimilarity } from '@/lib/import/title-match'

const c = (value: string, title: string, year: number | null, original?: string) => ({ value, titles: [title, original], year })

describe('normalizeTitle / titleSimilarity', () => {
  it('acentos, signos, & / and, guiones largos y artículo inicial', () => {
    expect(normalizeTitle('Amélie')).toBe(normalizeTitle('Amelie'))
    expect(normalizeTitle('Mission: Impossible – Fallout')).toBe(normalizeTitle('Mission: Impossible - Fallout'))
    expect(normalizeTitle('Harold & Kumar')).toBe(normalizeTitle('Harold and Kumar'))
    expect(normalizeTitle('The Matrix')).toBe(normalizeTitle('Matrix'))
    expect(normalizeTitle("Schindler's List")).toBe(normalizeTitle('Schindlers List'))
    expect(titleSimilarity('Se7en', 'Se7en')).toBe(1)
    expect(titleSimilarity('Dune', 'Dune: Part Two')).toBeLessThan(0.85)
  })

  it('sufijo de serie de Goodreads y apellido del autor', () => {
    expect(stripSeriesSuffix('The Hunger Games (The Hunger Games, #1)')).toBe('The Hunger Games')
    expect(stripSeriesSuffix('Dune (Dune Chronicles #1.5)')).toBe('Dune')
    expect(stripSeriesSuffix('Sapiens (edición)')).toBe('Sapiens (edición)')
    expect(authorKey('Herbert, Frank')).toBe(authorKey('Frank Herbert'))
  })
})

describe('pickTitleMatch', () => {
  it('remake: gana el del año de la fila, nunca el otro', () => {
    const candidates = [c('2018', 'Halloween', 2018), c('1978', 'Halloween', 1978), c('2007', 'Halloween', 2007)]
    expect(pickTitleMatch({ title: 'Halloween', year: 1978 }, candidates)?.value).toBe('1978')
    expect(pickTitleMatch({ title: 'Halloween', year: 2007 }, candidates)?.value).toBe('2007')
  })

  it('año ±1 (estreno en festival) solo con título idéntico; año exacto antes que ±1', () => {
    expect(pickTitleMatch({ title: 'Parasite', year: 2018 }, [c('p', 'Parasite', 2019)])?.value).toBe('p')
    expect(pickTitleMatch({ title: 'Parasites', year: 2018 }, [c('p', 'Parasite', 2019)])).toBeNull()
    expect(
      pickTitleMatch({ title: 'Dune', year: 2021 }, [c('1984', 'Dune', 2020), c('2021', 'Dune', 2021)])?.value
    ).toBe('2021')
  })

  it('dos candidatos idénticos a ±1 año y ninguno del año exacto: ambiguo, sin emparejar', () => {
    expect(pickTitleMatch({ title: 'Past Lives', year: 2022 }, [c('a', 'Past Lives', 2023), c('b', 'Past Lives', 2021)])).toBeNull()
    expect(pickTitleMatch({ title: 'Past Lives', year: 2022 }, [c('a', 'Past Lives', 2023), c('b', 'Past Lives', 2022)])?.value).toBe('b')
  })

  it('título parecido (≥ 0,85) solo con el mismo año', () => {
    expect(pickTitleMatch({ title: 'Spider-Man: Into the Spider-Verse', year: 2018 }, [c('s', 'Spider-Man: Into the Spiderverse', 2018)])?.value).toBe('s')
    expect(pickTitleMatch({ title: 'Spider-Man: Into the Spider-Verse', year: 2018 }, [c('s', 'Spider-Man: Into the Spiderverse', 2016)])).toBeNull()
  })

  it('compara también con el título original', () => {
    expect(pickTitleMatch({ title: 'Parasite', year: 2019 }, [c('k', '기생충', 2019, 'Parasite')])?.value).toBe('k')
  })

  it('años lejanos o títulos distintos: sin emparejar (mejor eso que mal)', () => {
    expect(pickTitleMatch({ title: 'Dune', year: 2021 }, [c('1984', 'Dune', 1984)])).toBeNull()
    expect(pickTitleMatch({ title: 'Birdman or (The Unexpected Virtue of Ignorance)', year: 2014 }, [c('b', 'Birdman', 2014)])).toBeNull()
    expect(pickTitleMatch({ title: 'X', year: 2000 }, [])).toBeNull()
  })

  it('sin año: solo título idéntico y sin rival idéntico de otro año', () => {
    expect(pickTitleMatch({ title: 'Cowboy Bebop' }, [c('cb', 'Cowboy Bebop', 1998)])?.value).toBe('cb')
    expect(pickTitleMatch({ title: 'Halloween' }, [c('a', 'Halloween', 1978), c('b', 'Halloween', 2018)])).toBeNull()
    expect(pickTitleMatch({ title: 'Cowboy Bebop' }, [c('cb', 'Cowboy Bebob', 1998)])).toBeNull()
  })
})
