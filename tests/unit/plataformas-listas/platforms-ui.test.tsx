// ============================================================
// F-25 (PRO-6) — Ajustes › Mis plataformas y la sección de Inicio.
// ============================================================

import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? ns + '.' : ''}${key}${values ? JSON.stringify(values) : ''}`,
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock('@/components/media/PosterImage', () => ({ PosterImage: () => null }))

const update = vi.fn()
const result = { data: [{ id: 'u1' }] as unknown[] | null, error: null as unknown }
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      update: (values: unknown) => {
        update(values)
        return { eq: () => ({ select: async () => result }) }
      },
    }),
  }),
}))

import { PlatformsSection, PLATFORMS_SAVE_DELAY_MS } from '@/app/[locale]/(app)/settings/PlatformsSection'
import { TonightClient } from '@/app/[locale]/(app)/home/TonightClient'

beforeEach(() => {
  vi.useFakeTimers()
  update.mockClear()
  result.data = [{ id: 'u1' }]
  result.error = null
})
afterEach(() => vi.useRealTimers())

describe('PlatformsSection', () => {
  it('casillas con nombre en un grupo con nombre, y región etiquetada', () => {
    render(<PlatformsSection userId="u1" initialServices={[8]} initialRegion="ES" />)
    const group = screen.getByRole('group', { name: /platforms\.groupLabel/ })
    expect(within(group).getByRole('checkbox', { name: 'Netflix' })).toBeChecked()
    expect(within(group).getByRole('checkbox', { name: 'Filmin' })).not.toBeChecked()
    expect(screen.getByRole('combobox', { name: 'platforms.region' })).toHaveValue('ES')
    expect(document.getElementById('platforms')).not.toBeNull()
  })

  it('varios toques seguidos → UNA escritura con todo, tras la pausa', async () => {
    render(<PlatformsSection userId="u1" initialServices={[]} initialRegion="ES" />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Netflix' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Filmin' }))
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('platforms.saving')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLATFORMS_SAVE_DELAY_MS + 10)
    })
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({ streaming_services: [8, 63], streaming_region: 'ES' })
    expect(screen.getByRole('status')).toHaveTextContent('platforms.saved')
  })

  it('si no se guarda (0 filas: RLS/demo), vuelve a lo guardado y lo avisa', async () => {
    result.data = []
    render(<PlatformsSection userId="u1" initialServices={[8]} initialRegion="ES" />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Filmin' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLATFORMS_SAVE_DELAY_MS + 10)
    })
    expect(screen.getByRole('alert')).toHaveTextContent('platforms.error')
    expect(screen.getByRole('checkbox', { name: 'Filmin' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Netflix' })).toBeChecked()
  })

  it('cambiar de región quita lo que no existe allí', async () => {
    render(<PlatformsSection userId="u1" initialServices={[8, 63]} initialRegion="ES" />)
    fireEvent.change(screen.getByRole('combobox', { name: 'platforms.region' }), { target: { value: 'US' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLATFORMS_SAVE_DELAY_MS + 10)
    })
    expect(update).toHaveBeenCalledWith({ streaming_services: [8], streaming_region: 'US' })
    expect(screen.getByRole('checkbox', { name: 'Hulu' })).toBeInTheDocument()
  })

  it('demo: se ve, pero deshabilitado y explicado', () => {
    render(<PlatformsSection userId="u1" initialServices={[]} initialRegion="ES" isDemo />)
    expect(screen.getByRole('checkbox', { name: 'Netflix' })).toBeDisabled()
    expect(screen.getByText('platforms.demoLocked')).toBeInTheDocument()
  })
})

describe('TonightClient', () => {
  const picks = [
    { mediaId: 'movie_1', title: 'Uno', poster: null, type: 'movie', platforms: ['Netflix'] },
    { mediaId: 'tv_2', title: 'Dos', poster: null, type: 'tv', platforms: ['Filmin'] },
  ]

  it('«Sorpréndeme» elige SOLO entre los disponibles y lo anuncia', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    render(<TonightClient picks={picks} platforms={['Netflix', 'Filmin']} />)
    expect(screen.getByRole('heading', { name: 'platforms.tonightTitle' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /platforms\.surprise/ }))
    expect(screen.getByRole('status')).toHaveTextContent('platforms.surprisePick{"title":"Dos","platforms":"Filmin"}')
    expect(screen.getByRole('link', { name: /surpriseOpen/ })).toHaveAttribute('href', '/media/tv/2')
    // Otro: no repite.
    fireEvent.click(screen.getByRole('button', { name: 'platforms.surpriseAgain' }))
    expect(screen.getByRole('status')).toHaveTextContent('"title":"Uno"')
    vi.restoreAllMocks()
  })

  it('sin disponibles: sin botón y con salida a Ajustes', () => {
    render(<TonightClient picks={[]} platforms={['Netflix']} />)
    expect(screen.queryByRole('button', { name: /surprise/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'platforms.editPlatforms' })).toHaveAttribute('href', '/settings#platforms')
  })
})
