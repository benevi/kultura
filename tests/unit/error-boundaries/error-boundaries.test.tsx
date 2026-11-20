/**
 * Tests unitarios para los error boundaries de rutas autenticadas.
 * Verifica que cada error.tsx renderiza el mensaje de error y el botón de reset.
 */
import type { ComponentProps } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      somethingWentWrong: 'Algo salió mal',
      tryAgain: 'Inténtalo de nuevo',
    }
    return map[key] ?? key
  },
  useLocale: () => 'es',
}))

// La salida usa el Link con idioma de next-intl (SalaLink): aquí, un <a>.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: ComponentProps<'a'>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

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

describe.each(BOUNDARIES)('$name', ({ Component }) => {
  it('renderiza mensaje de error como único h1', () => {
    render(<Component error={TEST_ERROR} reset={vi.fn()} />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Algo salió mal' })).toBeInTheDocument()
  })

  it('renderiza botón Reintentar y la salida', () => {
    render(<Component error={TEST_ERROR} reset={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Inténtalo de nuevo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'goHome' })).toHaveAttribute('href', Component === MediaDetailError ? '/' : '/home')
  })

  it('envía el error a Sentry una vez, con la etiqueta boundary', async () => {
    captureException.mockClear()
    const err = Object.assign(new Error('boom'), { digest: 'd1' })
    const { rerender } = render(<Component error={err} reset={vi.fn()} />)
    await waitFor(() => expect(captureException).toHaveBeenCalledTimes(1))
    expect(captureException).toHaveBeenCalledWith(err, { tags: { boundary: 'page' }, extra: { digest: 'd1' } })
    rerender(<Component error={err} reset={vi.fn()} />)
    await Promise.resolve()
    expect(captureException).toHaveBeenCalledTimes(1)
  })

  it('botón llama a reset() al hacer click', () => {
    const mockReset = vi.fn()
    render(<Component error={TEST_ERROR} reset={mockReset} />)
    const btn = screen.getByText('Inténtalo de nuevo')
    fireEvent.click(btn)
    expect(mockReset).toHaveBeenCalledOnce()
  })
})
