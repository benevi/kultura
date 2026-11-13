// ============================================================
// KULTURA — Saneamiento 12.6: prueba de restauración de cada copia
// scripts/restore-check.mjs (corre en backup.yml).
// ============================================================

import { describe, it, expect } from 'vitest'
import { compareCounts, prepareData } from '../../../scripts/restore-check.mjs'

const DUMP = [
  'SET session_replication_role = replica;',
  'COPY "auth"."users" ("id", "email") FROM stdin;',
  'u1\ta@x',
  'u2\tb@x',
  '\\.',
  'COPY "auth"."sessions" ("id") FROM stdin;',
  's1',
  '\\.',
  'COPY "public"."lists" ("id") FROM stdin;',
  '\\.',
  'COPY "public"."users" ("id") FROM stdin;',
  'u1',
  '\\.',
  'COPY "storage"."objects" ("id") FROM stdin;',
  'o1',
  '\\.',
  "SELECT pg_catalog.setval('\"public\".\"x_seq\"', 3, true);",
].join('\r\n')

describe('prepareData', () => {
  it('cuenta las filas de public.*, auth.users y auth.identities y deja fuera el resto', () => {
    const { sql, expected } = prepareData(DUMP)
    expect(expected).toEqual({ 'auth.users': 2, 'public.lists': 0, 'public.users': 1 })
    expect(sql).not.toContain('sessions')
    expect(sql).not.toContain('storage')
    expect(sql).toContain('COPY "public"."users"')
    expect(sql).toContain('SET session_replication_role')
    expect(sql).toContain('setval')
    expect(sql).not.toContain('\r')
  })
})

describe('compareCounts', () => {
  it('pasa si coinciden y falla si falta una tabla o cambia una cuenta', () => {
    const expected = { 'public.users': 1, 'public.lists': 0 }
    expect(compareCounts(expected, { 'public.users': 1, 'public.lists': 0 })).toEqual([])
    expect(compareCounts(expected, { 'public.users': 0 })).toEqual([
      'public.users: 0 filas restauradas, 1 en la copia',
      'public.lists: no existe en la base restaurada',
    ])
  })
})
