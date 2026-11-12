/**
 * Tests unitarios para los error boundaries de rutas autenticadas.
 * Verifica que cada error.tsx renderiza el mensaje de error y el botón de reset.
 */
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

const TEST_ERROR = new Error('Test error') as Error & { digest?: string }

const BOUNDARIES = [
  { name: 'LibraryError', Component: LibraryError },
  { name: 'ProfileError', Component: ProfileError },
  { name: 'NotificationsError', Component: NotificationsError },
  { name: 'FriendsError', Component: FriendsError },
  { name: 'DiscoverError', Component: DiscoverError },
  { name: 'SearchError', Component: SearchError },
  { name: 'MediaDetailError', Component: MediaDetailError },
]

describe.each(BOUNDARIES)('$name', ({ Component }) => {
  it('renderiza mensaje de error', () => {
    render(<Component error={TEST_ERROR} reset={vi.fn()} />)
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
  })

  it('renderiza botón Reintentar', () => {
    render(<Component error={TEST_ERROR} reset={vi.fn()} />)
    expect(screen.getByText('Inténtalo de nuevo')).toBeInTheDocument()
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
