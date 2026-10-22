// ============================================================
// KULTURA — Lógica común de denuncias (F-11)
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  allowedTargetTypes,
  normalizeReason,
  parsePublicTarget,
  storedReason,
} from '@/app/api/reports/shared'
import { reportReference } from '@/lib/social/actions'

const LIST = '0f8fad5b-d9cb-469f-a165-70867728950e'

describe('allowedTargetTypes', () => {
  it('sin MODERATION_V2 solo usuario y título (lo que admite la tabla sin migrar)', () => {
    expect(allowedTargetTypes(false, 'app')).toEqual(['user', 'media'])
    expect(allowedTargetTypes(false, 'public')).toEqual(['user', 'media'])
  })

  it('con MODERATION_V2: los seis con sesión; sin cuenta solo lo público', () => {
    expect(allowedTargetTypes(true, 'app')).toEqual(['user', 'media', 'message', 'group_post', 'group', 'list'])
    expect(allowedTargetTypes(true, 'public')).toEqual(['user', 'media', 'list'])
  })
})

describe('parsePublicTarget', () => {
  it('entiende enlaces de perfil, ficha y lista pública (con o sin idioma y dominio)', () => {
    expect(parsePublicTarget('user', 'https://kulturaapp.vercel.app/es/u/benevi')).toEqual({ kind: 'username', value: 'benevi' })
    expect(parsePublicTarget('user', '/en/profile/ana_b')).toEqual({ kind: 'username', value: 'ana_b' })
    expect(parsePublicTarget('media', 'https://kulturaapp.vercel.app/es/media/movie/550')).toEqual({ kind: 'id', value: 'movie_550' })
    expect(parsePublicTarget('list', `https://kulturaapp.vercel.app/es/u/benevi/l/${LIST}`)).toEqual({ kind: 'id', value: LIST })
  })

  it('acepta un nombre de usuario suelto (con @) o un id', () => {
    expect(parsePublicTarget('user', '@benevi')).toEqual({ kind: 'username', value: 'benevi' })
    expect(parsePublicTarget('user', LIST)).toEqual({ kind: 'id', value: LIST })
    expect(parsePublicTarget('media', 'anime_21')).toEqual({ kind: 'id', value: 'anime_21' })
  })

  it('rechaza lo que no apunta al tipo elegido', () => {
    expect(parsePublicTarget('media', 'https://kulturaapp.vercel.app/es/u/benevi')).toBeNull()
    expect(parsePublicTarget('list', 'no-es-un-id')).toBeNull()
    expect(parsePublicTarget('media', 'podcast_1')).toBeNull()
    expect(parsePublicTarget('user', 'nombre con espacios')).toBeNull()
  })
})

describe('motivo', () => {
  it('motivo conocido + detalle', () => {
    const r = normalizeReason('spam', '  enlaces  ')
    expect(r).toEqual({ reason: 'spam', details: 'enlaces' })
    expect(storedReason(r.reason, r.details)).toBe('spam: enlaces')
  })

  it('texto libre antiguo → other', () => {
    expect(normalizeReason('Me insulta', undefined)).toEqual({ reason: 'other', details: 'Me insulta' })
    expect(normalizeReason(undefined, undefined)).toEqual({ reason: 'other', details: null })
    expect(storedReason('other', null)).toBe('other')
  })
})

describe('reportReference', () => {
  it('KR- y 8 hex en mayúsculas, estable para el mismo id', () => {
    expect(reportReference('0f8fad5b-d9cb-469f-a165-70867728950e')).toBe('KR-0F8FAD5B')
  })
})
