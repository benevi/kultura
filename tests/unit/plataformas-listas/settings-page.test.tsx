// ============================================================
// F-25 — Ajustes: «Mis plataformas» solo si su tabla privada existe (antes de
// la migración no falla nada: no sale). Nunca se lee de `users`.
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { fakeSupabase, type FakeClient } from './fake-supabase'

let client: FakeClient
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('redirect') }) }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }))
vi.mock('@/app/[locale]/(app)/settings/SettingsForm', () => ({ SettingsForm: () => null }))
vi.mock('@/app/api/settings/account-state', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/api/settings/account-state')>()),
  readAccountState: async () => ({ state: null, migrated: false }),
}))

import { PlatformsSection } from '@/app/[locale]/(app)/settings/PlatformsSection'

async function render(platforms: { data: unknown; error: { code: string } | null }) {
  client = fakeSupabase({
    user: { id: 'u1' },
    tables: { users: [{ data: { id: 'u1', username: 'ana' }, error: null }], user_streaming_services: [platforms] },
  })
  ;(client.auth as { getUser: () => Promise<unknown> }).getUser = async () => ({
    data: { user: { id: 'u1', email: 'a@b.c', app_metadata: {} } },
    error: null,
  })
  const { default: Page } = await import('@/app/[locale]/(app)/settings/page')
  const main = (await Page({ params: Promise.resolve({ locale: 'en' }) })) as ReactElement<{ children: ReactElement<{ platformsSlot: ReactElement | null }> }>
  return main.props.children.props.platformsSlot
}

describe('Ajustes › Mis plataformas', () => {
  it('sin la tabla (antes de la migración): no se pinta', async () => {
    expect(await render({ data: null, error: { code: 'PGRST205' } })).toBeNull()
  })

  it('con la tabla: la sección, con lo guardado y la región del idioma si no hay', async () => {
    const slot = await render({ data: { services: [8, 8, 63], region: null }, error: null })
    expect(slot?.type).toBe(PlatformsSection)
    expect(slot?.props).toMatchObject({ userId: 'u1', initialServices: [8, 63], initialRegion: 'US', isDemo: false })
    expect(client.calls.find((c) => c.table === 'user_streaming_services')?.ops).toContainEqual({ name: 'eq', args: ['user_id', 'u1'] })
  })

  it('sin fila (nunca las guardó): sección vacía', async () => {
    const slot = await render({ data: null, error: null })
    expect(slot?.props).toMatchObject({ initialServices: [], initialRegion: 'US' })
  })
})
