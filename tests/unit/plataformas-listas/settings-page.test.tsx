// ============================================================
// F-25 — Ajustes: «Mis plataformas» solo si la columna existe (la página lee
// `select('*')`, así que antes de la migración no falla nada: no sale).
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

async function render(profile: Record<string, unknown>) {
  client = fakeSupabase({ user: { id: 'u1' }, tables: { users: [{ data: profile, error: null }] } })
  ;(client.auth as { getUser: () => Promise<unknown> }).getUser = async () => ({
    data: { user: { id: 'u1', email: 'a@b.c', app_metadata: {} } },
    error: null,
  })
  const { default: Page } = await import('@/app/[locale]/(app)/settings/page')
  const main = (await Page({ params: Promise.resolve({ locale: 'en' }) })) as ReactElement<{ children: ReactElement<{ platformsSlot: ReactElement | null }> }>
  return main.props.children.props.platformsSlot
}

describe('Ajustes › Mis plataformas', () => {
  it('sin la columna (antes de la migración): no se pinta', async () => {
    expect(await render({ id: 'u1', username: 'ana' })).toBeNull()
  })

  it('con la columna: la sección, con lo guardado y la región del idioma si no hay', async () => {
    const slot = await render({ id: 'u1', username: 'ana', streaming_services: [8, 8, 63], streaming_region: null })
    expect(slot?.type).toBe(PlatformsSection)
    expect(slot?.props).toMatchObject({ userId: 'u1', initialServices: [8, 63], initialRegion: 'US', isDemo: false })
  })
})
