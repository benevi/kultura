/**
 * Tests unitarios de los once error.tsx: mensaje, «Reintentar», la salida
 * (Inicio con sesión, portada en las públicas) y el envío a Sentry.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      somethingWentWrong: 'Algo salió mal',
      tryAgain: 'Inténtalo de nuevo',
      goHome: 'Ir al inicio',
    }
    return map[key] ?? key
  },
  useLocale: () => 'es',
}))

vi.mock('next/navigation', () => ({ useParams: () => ({ locale: 'es' }) }))

// Saneamiento 10.1: ErrorState manda el error a Sentry (SDK bajo demanda).
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  loadSentry: () => Promise.resolve({ captureException }),
}))

// Importación dinámica para aislar cada componente
import LibraryError from '@/app/[locale]/(app)/library/error'
import ProfileError from '@/app/[locale]/(app)/profile/[username]/error'
import NotificationsError from '@/app/[locale]/(app)/notifications/error'
import FriendsError from '@/app/[locale]/(app)/friends/error'
import DiscoverError from '@/app/[locale]/(app)/discover/error'
import SearchError from '@/app/[locale]/(app)/search/error'
import MediaDetailError from '@/app/[locale]/media/[type]/[id]/error'
import HomeError from '@/app/[locale]/(app)/home/error'
import ListsError from '@/app/[locale]/(app)/lists/error'
import AppError from '@/app/[locale]/(app)/error'
import LocaleError from '@/app/[locale]/error'

const TEST_ERROR = new Error('Test error') as Error & { digest?: string }

const BOUNDARIES = [
  { name: 'LibraryError', Component: LibraryError },
  { name: 'ProfileError', Component: ProfileError },
  { name: 'NotificationsError', Component: NotificationsError },
  { name: 'FriendsError', Component: FriendsError },
  { name: 'DiscoverError', Component: DiscoverError },
  { name: 'SearchError', Component: SearchError },
  { name: 'MediaDetailError', Component: MediaDetailError },
  { name: 'HomeError', Component: HomeError },
  { name: 'ListsError', Component: ListsError },
  { name: 'AppError', Component: AppError },
  { name: 'LocaleError', Component: LocaleError },
]

// Páginas públicas: «Ir al inicio» lleva a la portada, que no pide sesión.
const PUBLIC = new Set<unknown>([MediaDetailError, LocaleError])

// `LocaleError` pide el estado de error al montarse (next/dynamic, fuera del JS
// inicial de la portada): se espera al título antes de mirar nada.
const renderBoundary = async (ui: React.ReactElement) => {
  const result = render(ui)
  await screen.findByRole('heading', { level: 1 })
  return result
}

describe.each(BOUNDARIES)('$name', ({ Component }) => {
  it('renderiza mensaje de error como único h1', async () => {
    await renderBoundary(<Component error={TEST_ERROR} reset={vi.fn()} />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Algo salió mal' })).toBeInTheDocument()
  })

  it('renderiza botón Reintentar y la salida', async () => {
    await renderBoundary(<Component error={TEST_ERROR} reset={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Inténtalo de nuevo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', PUBLIC.has(Component) ? '/es' : '/es/home')
  })

  it('envía el error a Sentry una vez, con la etiqueta boundary', async () => {
    captureException.mockClear()
    const err = Object.assign(new Error('boom'), { digest: 'd1' })
    const { rerender } = await renderBoundary(<Component error={err} reset={vi.fn()} />)
    await waitFor(() => expect(captureException).toHaveBeenCalledTimes(1))
    expect(captureException).toHaveBeenCalledWith(err, { tags: { boundary: 'page' }, extra: { digest: 'd1' } })
    rerender(<Component error={err} reset={vi.fn()} />)
    await Promise.resolve()
    expect(captureException).toHaveBeenCalledTimes(1)
  })

  it('botón llama a reset() al hacer click', async () => {
    const mockReset = vi.fn()
    await renderBoundary(<Component error={TEST_ERROR} reset={mockReset} />)
    const btn = screen.getByText('Inténtalo de nuevo')
    fireEvent.click(btn)
    expect(mockReset).toHaveBeenCalledOnce()
  })
})

// Presupuesto de JS de la portada (lighthouserc.json): el límite de `[locale]`
// va en el JS inicial de todas las páginas públicas. Un import estático del
// estado de error volvía a meter «Sala» y tailwind-merge (≈ 10 KB gz) en /es.
describe('LocaleError fuera del JS inicial', () => {
  it('pide ErrorState con import() dinámico, no con un import estático', () => {
    const src = readFileSync(resolve(__dirname, '../../../src/app/[locale]/error.tsx'), 'utf8')
    expect(src).not.toMatch(/^import[^\n]*['"]@\/components\/(layout|sala)\//m)
    expect(src).toMatch(/import\(\s*['"]@\/components\/layout\/ErrorState['"]\s*\)/)
  })
})
