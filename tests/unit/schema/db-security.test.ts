// ============================================================
// KULTURA — Saneamiento 12.2: seguridad de la base en el CI
// scripts/check-db-security.mjs (corre en CI contra Supabase local).
// ============================================================

import fs from 'node:fs'
import { describe, it, expect } from 'vitest'
import { checkDbSecurity, ALLOWLIST } from '../../../scripts/check-db-security.mjs'

const allow = { anon: ['pub(x uuid)'], authenticated: ['pub(x uuid)', 'helper(y uuid)'] }
const clean = {
  rls: [],
  views: [],
  definer: [
    { fn: 'pub(x uuid)', anon: true, authenticated: true },
    { fn: 'helper(y uuid)', anon: false, authenticated: true },
    { fn: 'solo_servicio()', anon: false, authenticated: false },
  ],
}

describe('checkDbSecurity', () => {
  it('pasa si todo coincide con la lista', () => {
    expect(checkDbSecurity(clean, allow)).toEqual([])
  })

  it('falla con una función SECURITY DEFINER nueva ejecutable por anon', () => {
    const state = { ...clean, definer: [...clean.definer, { fn: 'nueva()', anon: true, authenticated: true }] }
    const problems = checkDbSecurity(state, allow)
    expect(problems).toHaveLength(2)
    expect(problems[0]).toMatch(/anon puede ejecutar .*nueva\(\)/)
  })

  it('falla si la lista tiene una que ya no aplica', () => {
    const state = { ...clean, definer: clean.definer.filter((d) => d.fn !== 'helper(y uuid)') }
    expect(checkDbSecurity(state, allow)).toEqual([
      `${ALLOWLIST}: authenticated ya no ejecuta helper(y uuid); quítala de la lista`,
    ])
  })

  it('falla con rls_audit() y con vistas sin security_invoker', () => {
    const problems = checkDbSecurity({ ...clean, rls: ['t'], views: ['v'] }, allow)
    expect(problems).toEqual([
      'rls_audit(): la tabla t no está ok',
      'la vista v no tiene security_invoker (se salta la RLS)',
    ])
  })

  it('la lista del repo es JSON válido con anon y authenticated', () => {
    const repo = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'))
    expect(Array.isArray(repo.anon)).toBe(true)
    expect(Array.isArray(repo.authenticated)).toBe(true)
  })
})
