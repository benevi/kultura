// ============================================================
// KULTURA — Textos de "Para ti" (TXT-3)
//
// `AiRecommendations.tsx` usaba `useTranslations('mediaDetail')`, un namespace
// que no existe (el real es `media_detail`): next-intl daba MISSING_MESSAGE y
// pintaba la ruta de la clave en vez de la frase. Ahora todo sale de
// `aiRecommendations`. Este test lee el componente, saca cada namespace y cada
// clave que usa, y comprueba que existen en es y en en con createTranslator.
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { createTranslator } from 'next-intl'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'

const SOURCE = readFileSync(
  path.resolve(__dirname, '../../../src/components/home/AiRecommendations.tsx'),
  'utf8'
)

/** `const x = useTranslations('ns')` → { x: 'ns' } */
function translators(source: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of Array.from(source.matchAll(/const\s+(\w+)\s*=\s*useTranslations\(\s*'([^']+)'\s*\)/g))) {
    out[m[1]] = m[2]
  }
  return out
}

/** Claves literales usadas con cada traductor: `t('key'` → ['t', 'key']. */
function usedKeys(source: string, names: string[]): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const name of names) {
    const re = new RegExp(`\\b${name}\\(\\s*'([^']+)'`, 'g')
    for (const m of Array.from(source.matchAll(re))) out.push([name, m[1]])
  }
  return out
}

describe('AiRecommendations — namespaces y claves existen (TXT-3)', () => {
  const map = translators(SOURCE)

  it('solo usa el namespace aiRecommendations (ya no el inexistente mediaDetail)', () => {
    expect(Object.values(map)).toEqual(['aiRecommendations'])
    expect(SOURCE).not.toMatch(/useTranslations\(\s*'mediaDetail'/)
  })

  for (const [locale, messages] of [['es', es], ['en', en]] as const) {
    it(`cada clave usada existe en ${locale} sin MISSING_MESSAGE`, () => {
      const errors: string[] = []
      const keys = usedKeys(SOURCE, Object.keys(map))
      expect(keys.length).toBeGreaterThan(10)

      for (const [name, key] of keys) {
        const t = createTranslator({
          locale,
          messages,
          namespace: map[name] as 'aiRecommendations',
          onError: (e) => errors.push(`${map[name]}.${key}: ${e.code}`),
        })
        t(key as 'title', { genres: 'Drama, Thriller' })
      }

      expect(errors).toEqual([])
    })

    it(`whyRecommendedText interpola los géneros en ${locale}`, () => {
      const t = createTranslator({ locale, messages, namespace: 'aiRecommendations' })
      expect(t('whyRecommendedText', { genres: 'Drama, Thriller' })).toContain('Drama, Thriller')
    })
  }
})
