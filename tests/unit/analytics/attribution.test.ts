// D-12: la atribución del alta viaja por la URL (sin cookies) y se limpia.
import { describe, it, expect } from 'vitest'
import {
  parseAttribution,
  parseAttributionRecord,
  storedAttribution,
  toStoredAttribution,
  withAttribution,
} from '@/lib/analytics/attribution'

const qs = (s: string) => new URLSearchParams(s)
// Formato `<exp>.<hmac>` (caduca): el de 20 hex de antes ya no se acepta.
const SIG = '1790000000.0123456789abcdef0123456789abcdef'

describe('parseAttribution', () => {
  it('sin nada → direct', () => {
    expect(parseAttribution(qs(''))).toEqual({ channel: 'direct' })
    expect(parseAttribution(null)).toEqual({ channel: 'direct' })
  })

  it('utm_* → canal utm, valores en minúsculas y recortados', () => {
    const a = parseAttribution(qs('utm_source=Reddit&utm_medium=post&utm_campaign=%20Anime%20&utm_term=x&utm_content=y'))
    expect(a).toEqual({
      channel: 'utm', utm_source: 'reddit', utm_medium: 'post', utm_campaign: 'anime', utm_term: 'x', utm_content: 'y',
    })
  })

  it('quita caracteres de control y de marcado, y limita la longitud', () => {
    const a = parseAttribution(qs(`utm_source=${encodeURIComponent('<script>"x\u0007')}&utm_campaign=${'a'.repeat(300)}`))
    expect(a.utm_source).toBe('scriptx')
    expect(a.utm_campaign).toHaveLength(100)
  })

  it('ref → canal ref; inv solo si tiene formato y acompaña a un ref', () => {
    expect(parseAttribution(qs(`ref=ana.gil&inv=${SIG}`))).toEqual({ channel: 'ref', ref: 'ana.gil', inv: SIG })
    expect(parseAttribution(qs('ref=ana&inv=zzz'))).toEqual({ channel: 'ref', ref: 'ana' })
    expect(parseAttribution(qs('ref=ana&inv=0123456789abcdef0123'))).toEqual({ channel: 'ref', ref: 'ana' })
    expect(parseAttribution(qs(`inv=${SIG}`))).toEqual({ channel: 'direct' })
    expect(parseAttribution(qs('ref=<b>'))).toEqual({ channel: 'direct' })
  })

  it('utm y ref a la vez: canal utm, se conservan los dos', () => {
    expect(parseAttribution(qs('ref=ana&utm_source=x'))).toMatchObject({ channel: 'utm', ref: 'ana', utm_source: 'x' })
  })

  it('searchParams de una página de Next (string | string[])', () => {
    expect(parseAttributionRecord({ utm_source: ['a', 'b'], ref: 'ana' })).toMatchObject({ utm_source: 'a', ref: 'ana' })
  })
})

describe('guardar y reenviar', () => {
  it('lo que se guarda no lleva la firma', () => {
    expect(toStoredAttribution({ channel: 'ref', ref: 'ana', inv: SIG })).toEqual({ channel: 'ref', ref: 'ana' })
  })

  it('storedAttribution relee los metadatos del alta (y descarta basura)', () => {
    expect(storedAttribution({ channel: 'utm', utm_source: 'reddit', extra: 1 })).toEqual({ channel: 'utm', utm_source: 'reddit' })
    expect(storedAttribution('x')).toBeNull()
    expect(storedAttribution(null)).toBeNull()
  })

  it('withAttribution añade los parámetros a una ruta con o sin query', () => {
    const a = parseAttribution(qs(`utm_source=x&ref=ana&inv=${SIG}`))
    expect(withAttribution('/login?mode=register', a)).toBe(`/login?mode=register&utm_source=x&ref=ana&inv=${SIG}`)
    expect(withAttribution('/login', { channel: 'direct' })).toBe('/login')
    expect(withAttribution('/a#b', { channel: 'ref', ref: 'ana' })).toBe('/a?ref=ana#b')
  })
})
