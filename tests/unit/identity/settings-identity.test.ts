// ============================================================
// KULTURA — /api/settings: identidad y onboarding (F-12)
// Nombres reservados, nombres antiguos de otros, visibilidad de la biblioteca
// (con y sin migración), aceptación de términos y fin del onboarding.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const AUTH_USER = { id: 'user-001', email: 'nombre.apellido@x.com', app_metadata: { provider: 'google' } }

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  userTables: {} as Record<string, unknown>,
  adminTables: {} as Record<string, unknown>,
  updateUserById: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: h.getUser },
    from: (table: string) => h.userTables[table],
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => h.adminTables[table],
    auth: { admin: { updateUserById: h.updateUserById } },
  }),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }) }
})

/**
 * Cadena de PostgREST: `maybeSingle` resuelve a `lookup`, y `single` (fin de
 * update…select) a lo que diga `writes` en orden (para probar reintentos).
 */
function table(opts: { lookup?: unknown; writes?: unknown[]; upsert?: unknown } = {}) {
  const writes = [...(opts.writes ?? [{ data: {}, error: null }])]
  const c: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select', 'eq', 'neq', 'update']) c[m] = vi.fn(() => c)
  c.maybeSingle = vi.fn(async () => opts.lookup ?? { data: null, error: null })
  c.single = vi.fn(async () => writes.shift() ?? { data: {}, error: null })
  c.upsert = vi.fn(async () => opts.upsert ?? { error: null })
  return c
}

function patch(body: unknown) {
  return new Request('http://localhost/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

async function run(body: unknown) {
  const { PATCH } = await import('@/app/api/settings/route')
  return PATCH(patch(body))
}

describe('PATCH /api/settings — identidad (F-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.getUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    h.updateUserById.mockResolvedValue({ error: null })
    h.userTables = { users: table() }
    h.adminTables = { users: table(), username_history: table(), account_state: table() }
  })

  it.each(['admin', 'Soporte', 'kultura_oficial', 'KULTURA'])('rechaza el nombre reservado %s', async (name) => {
    const res = await run({ username: name })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('username_reserved')
    expect((h.adminTables.users as ReturnType<typeof table>).update).not.toHaveBeenCalled()
  })

  it('un nombre antiguo de OTRA persona no se puede coger (secuestraría sus enlaces)', async () => {
    h.adminTables.username_history = table({ lookup: { data: { user_id: 'otra' }, error: null } })
    const res = await run({ username: 'pepe_viejo' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('username_taken')
  })

  it('volver a un nombre antiguo PROPIO sí se puede', async () => {
    h.adminTables.username_history = table({ lookup: { data: { user_id: AUTH_USER.id }, error: null } })
    const res = await run({ username: 'mi_viejo' })
    expect(res.status).toBe(200)
  })

  it('reenviar el nombre que ya tiene no lo revalida ni usa el admin', async () => {
    // Nombre antiguo que hoy estaría reservado: guardar el color no puede fallar.
    h.userTables.users = table({ lookup: { data: { username: 'kulturafan' }, error: null } })
    const res = await run({ username: 'kulturafan', avatar_color: 'teal' })
    expect(res.status).toBe(200)
    expect((h.userTables.users as ReturnType<typeof table>).update).toHaveBeenCalledWith({ avatar_color: 'teal' })
    expect((h.adminTables.users as ReturnType<typeof table>).update).not.toHaveBeenCalled()
  })

  it('el CHECK de la base (23514) se traduce a username_reserved', async () => {
    h.adminTables.users = table({ writes: [{ data: null, error: { code: '23514' } }] })
    const res = await run({ username: 'raro_ok' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('username_reserved')
  })

  it('library_visibility se escribe con el JWT del usuario (RLS + demo_no_update)', async () => {
    const res = await run({ library_visibility: 'private' })
    expect(res.status).toBe(200)
    expect((h.userTables.users as ReturnType<typeof table>).update).toHaveBeenCalledWith({
      library_visibility: 'private',
    })
  })

  it('rechaza una visibilidad inventada', async () => {
    const res = await run({ library_visibility: 'everyone' })
    expect(res.status).toBe(400)
  })

  it('sin la columna (migración sin aplicar) guarda el resto y avisa de lo ignorado', async () => {
    const users = table({
      writes: [
        { data: null, error: { code: 'PGRST204', message: "Could not find the 'library_visibility' column" } },
        { data: { avatar_color: 'teal' }, error: null },
      ],
    })
    h.userTables.users = users
    const res = await run({ avatar_color: 'teal', library_visibility: 'friends' })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ignored).toEqual(['library_visibility'])
    expect(users.update).toHaveBeenLastCalledWith({ avatar_color: 'teal' })
  })

  it('accept_terms guarda terms_accepted_at y la versión en account_state (admin)', async () => {
    const state = table()
    h.adminTables.account_state = state
    const res = await run({ accept_terms: true })
    expect(res.status).toBe(200)
    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: AUTH_USER.id,
        terms_accepted_at: expect.any(String),
        terms_version: '2026-09',
      }),
      { onConflict: 'user_id' }
    )
  })

  it('sin account_state, la aceptación va a app_metadata (que el usuario no puede tocar)', async () => {
    h.adminTables.account_state = table({ upsert: { error: { code: '42P01' } } })
    const res = await run({ accept_terms: true, onboarding_done: true })
    expect(res.status).toBe(200)
    expect(h.updateUserById).toHaveBeenCalledWith(AUTH_USER.id, {
      app_metadata: expect.objectContaining({ provider: 'google', terms_accepted_at: expect.any(String) }),
    })
    expect(h.updateUserById).toHaveBeenCalledWith(AUTH_USER.id, {
      app_metadata: expect.objectContaining({ onboarded_at: expect.any(String) }),
    })
  })

  it('accept_terms solo admite true', async () => {
    const res = await run({ accept_terms: false })
    expect(res.status).toBe(400)
  })

  it('la demo no acepta ni termina nada', async () => {
    h.getUser.mockResolvedValue({ data: { user: { ...AUTH_USER, app_metadata: { demo: true } } }, error: null })
    const res = await run({ onboarding_done: true })
    expect(res.status).toBe(403)
  })
})
