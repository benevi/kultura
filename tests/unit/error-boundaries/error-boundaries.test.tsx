/**
 * Tests unitarios para los error boundaries de rutas autenticadas.
 * Verifica que cada error.tsx renderiza el mensaje de error y el botón de reset.
 */
import { render, screen, fireEvent } from '@testing-library/react'
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

// Importación dinámica para aislar cada componente
import LibraryError from '@/app/[locale]/(app)/library/error'
import ProfileError from '@/app/[locale]/(app)/profile/[username]/error'
import NotificationsError from '@/app/[locale]/(app)/notifications/error'
import FriendsError from '@/app/[locale]/(app)/friends/error'
import DiscoverError from '@/app/[locale]/(app)/discover/error'
import SearchError from '@/app/[locale]/(app)/search/error'
import MediaDetailError from '@/app/[locale]/(app)/media/[type]/[id]/error'

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

  it('botón llama a reset() al hacer click', () => {
    const mockReset = vi.fn()
    render(<Component error={TEST_ERROR} reset={mockReset} />)
    const btn = screen.getByText('Inténtalo de nuevo')
    fireEvent.click(btn)
    expect(mockReset).toHaveBeenCalledOnce()
  })
})
