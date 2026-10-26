// DIS-14 · Quitar con «Deshacer» con el aviso de verdad (ToastProvider):
// el foco va a «Deshacer», el borrado real espera a que el aviso se vaya y
// «Deshacer» lo cancela.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LibraryEntry } from '@/types/library'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
const actions = vi.hoisted(() => ({
  saveLibraryEntry: vi.fn(),
  removeFromLibrary: vi.fn(async () => undefined),
  fetchDiaryConfig: vi.fn(async () => ({ enabled: true, scale: 'stars', logs: [{ id: 'l1' }] })),
  deleteDiaryLog: vi.fn(),
  fetchProgressConfig: vi.fn(async () => null),
}))
vi.mock('@/lib/library/actions', () => actions)

import { ToastProvider } from '@/components/ui/ToastProvider'
import { LibraryAction, __resetDiaryCache } from '@/components/library/LibraryAction'

const ENTRY: LibraryEntry = {
  id: 'e1', userId: 'u1', mediaId: 'movie_550', status: 'completed', score: 4,
  watchedAt: null, episodeProgress: null, createdAt: '2026-01-01T00:00:00Z',
}

function renderIt() {
  return render(
    <ToastProvider>
      <LibraryAction
        mediaId="movie_550"
        mediaCache={{ externalId: '550', type: 'movie', title: 'El club de la lucha' }}
        initialEntry={ENTRY}
        isAuthenticated
      />
    </ToastProvider>
  )
}

async function confirmRemove() {
  fireEvent.click(screen.getByText('remove'))
  fireEvent.click(screen.getByRole('button', { name: 'removeConfirm' }))
  return screen.findByRole('button', { name: 'undo' })
}

describe('quitar de la biblioteca con «Deshacer»', () => {
  beforeEach(() => {
    __resetDiaryCache()
    Object.values(actions).forEach((fn) => fn.mockClear())
  })

  it('tras confirmar, el foco va a «Deshacer»', async () => {
    renderIt()
    const undo = await confirmRemove()
    await waitFor(() => expect(document.activeElement).toBe(undo))
  })

  it('«Deshacer» cancela el borrado: ni DELETE ni se vuelve a guardar', async () => {
    renderIt()
    const undo = await confirmRemove()
    fireEvent.click(undo)
    expect(await screen.findByText('status.completed')).toBeInTheDocument()
    await act(async () => { await new Promise((r) => setTimeout(r, 250)) })
    expect(actions.removeFromLibrary).not.toHaveBeenCalled()
    expect(actions.saveLibraryEntry).not.toHaveBeenCalled()
  })

  it('cerrar el aviso confirma el borrado', async () => {
    renderIt()
    await confirmRemove()
    const close = screen.getAllByRole('button', { name: 'dismiss' }).at(-1)!
    fireEvent.click(close)
    await waitFor(() => expect(actions.removeFromLibrary).toHaveBeenCalledWith('movie_550'))
  })
})
