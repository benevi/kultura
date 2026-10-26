/**
 * ACC-1/2/3, X5 — los diálogos migrados a `Modal` tienen nombre, todos sus
 * campos tienen etiqueta, los errores se anuncian y el foco va al campo que
 * falla. Crear lista pregunta pública o privada, con privada marcada.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? ns + '.' : ''}${key}${values ? JSON.stringify(values) : ''}`,
  useLocale: () => 'es',
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

const mockShow = vi.fn()
const mockShowError = vi.fn()
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: mockShow, showError: mockShowError, dismiss: vi.fn() }),
}))

import { CreateListModal } from '@/components/social/CreateListModal'
import { RecommendModal } from '@/components/social/RecommendModal'
import { AddToListButton } from '@/components/social/AddToListButton'
import { InviteFriendsModal } from '@/components/social/InviteFriendsModal'
import { LibraryStatusModal } from '@/components/library/LibraryStatusModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { MediaItem } from '@/types/media'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

/** Todo control de formulario visible tiene nombre accesible. */
function expectLabelledControls(container: HTMLElement) {
  const controls = container.querySelectorAll<HTMLElement>('input:not([type=hidden]), select, textarea, button')
  for (const el of Array.from(controls)) {
    if (el.closest('[aria-hidden="true"]')) continue
    expect(el, el.outerHTML.slice(0, 120)).toHaveAccessibleName()
  }
}

describe('CreateListModal', () => {
  it('diálogo con nombre, campos etiquetados y visibilidad privada por defecto (X5)', () => {
    render(<CreateListModal onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'lists.createList' })
    expectLabelledControls(dialog)
    expect(screen.getByRole('textbox', { name: 'lists.listName' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'lists.mediaType' })).toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'lists.visibilityLabel' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /lists\.visibilityPrivate/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /lists\.visibilityPublic/ })).not.toBeChecked()
    // El placeholder ya no está fijo en español.
    expect(screen.getByRole('textbox', { name: 'lists.listName' })).toHaveAttribute('placeholder', 'lists.namePlaceholder')
  })

  it('enviar sin nombre: error anunciado, enlazado y el foco vuelve al campo', async () => {
    render(<CreateListModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'lists.create' }))
    const field = screen.getByRole('textbox', { name: 'lists.listName' })
    expect(screen.getAllByRole('alert').some((a) => a.textContent === 'lists.nameRequired')).toBe(true)
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('lists.nameRequired')
    expect(document.activeElement).toBe(field)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('una sola petición: la visibilidad va en el alta (F-25; antes un PATCH aparte que podía fallar)', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ list: { id: 'l1' } }) })
    const { unmount } = render(<CreateListModal onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'lists.listName' }), { target: { value: 'Mi lista' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.create' }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/lists/l1'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ isPublic: false })
    unmount()

    fetchMock.mockClear()
    render(<CreateListModal onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'lists.listName' }), { target: { value: 'Mi lista' } })
    fireEvent.click(screen.getByRole('radio', { name: /lists\.visibilityPublic/ }))
    fireEvent.click(screen.getByRole('button', { name: 'lists.create' }))
    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/lists', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ isPublic: true })
  })

  it('si el alta falla, el error se anuncia dentro del diálogo y no navega', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'x' }) })
    render(<CreateListModal onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'lists.listName' }), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.create' }))
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => a.textContent === 'lists.errorCreate')).toBe(true))
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('RecommendModal', () => {
  it('nombre, casillas en un grupo con nombre, mensaje etiquetado y textos traducidos', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        friends: [{ friendshipId: 'f', user: { id: 'u2', username: 'ada', avatar_color: 'blue', avatar_initials: 'AD' } }],
      }),
    })
    render(<RecommendModal mediaId="movie_1" mediaCache={{ externalId: '1', type: 'movie', title: 'T' }} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'recommendations.recommendTo' })
    expect(screen.getByText('recommendations.loadingFriends')).toHaveAttribute('role', 'status')
    await waitFor(() => expect(screen.getByText('ada')).toBeInTheDocument())
    expect(screen.getByRole('group', { name: 'recommendations.selectFriends' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'recommendations.message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'recommendations.cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument()
    expectLabelledControls(dialog)
  })
})

describe('AddToListButton', () => {
  const item = { id: 'movie_1', externalId: '1', type: 'movie', title: 'T' } as MediaItem

  it('el diálogo tiene nombre, la carga se anuncia traducida y las listas son radios agrupados', async () => {
    let resolve: (v: unknown) => void = () => {}
    fetchMock.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<AddToListButton item={item} />)
    fireEvent.click(screen.getByRole('button', { name: 'lists.addToList' }))
    const dialog = screen.getByRole('dialog', { name: 'lists.addToListTitle' })
    expect(screen.getByRole('status', { name: 'common.loading' })).toBeInTheDocument()
    resolve({ ok: true, json: async () => ({ lists: [{ id: 'l1', name: 'Favs', media_type: 'movie', is_collaborative: false }] }) })
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Favs' })).toBeInTheDocument())
    expect(screen.getByRole('group', { name: 'lists.selectList' })).toBeInTheDocument()
    expectLabelledControls(dialog)
  })
})

describe('InviteFriendsModal', () => {
  it('nombre, carga traducida y cada "Invitar" dice a quién', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ friends: [{ id: 'u2', username: 'ada', avatarColor: 'blue', avatarInitials: 'AD' }] }),
    })
    render(<InviteFriendsModal groupId="g1" onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'groups.inviteFriends' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'common.loading' })).toBeInTheDocument()
    const invite = await screen.findByRole('button', { name: 'groups.invite' })
    expect(invite).toHaveAccessibleDescription('ada')
  })
})

describe('LibraryStatusModal', () => {
  it('hoja con nombre; estado, nota, fecha y episodios etiquetados', () => {
    render(
      <LibraryStatusModal
        current={{ status: 'completed' } as never}
        mediaType="tv"
        onSave={vi.fn()}
        onClose={vi.fn()}
        loading={false}
      />
    )
    const dialog = screen.getByRole('dialog', { name: 'library.updateEntry' })
    expect(screen.getByRole('combobox', { name: 'library.statusLabel' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'library.score' })).toBeInTheDocument()
    expect(screen.getByLabelText('library.watchedAt')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'progress.season' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'progress.episode' })).toBeInTheDocument()
    expect(screen.getByTestId('sheet-handle')).toBeInTheDocument()
    expectLabelledControls(dialog)
  })

  it('el foco entra en el selector de estado (no en el ×)', async () => {
    render(<LibraryStatusModal current={null} mediaType="movie" onSave={vi.fn()} onClose={vi.fn()} loading={false} />)
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'library.statusLabel' }))
    )
  })
})

describe('ConfirmModal', () => {
  it('sin × (duplicaba Cancelar) y con el error dentro del diálogo', () => {
    render(
      <ConfirmModal isOpen title="T" message="M" confirmLabel="Borrar" cancelLabel="Cancelar" onConfirm={vi.fn()} onCancel={vi.fn()} error="Ha fallado" />
    )
    const dialog = screen.getByRole('alertdialog')
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancelar', 'Borrar'])
    expect(dialog.querySelector('[role="alert"]')).toHaveTextContent('Ha fallado')
  })

  it('alertdialog con título y mensaje; el foco empieza en Cancelar (lo seguro)', async () => {
    render(
      <ConfirmModal isOpen title="¿Borrar?" message="No se puede deshacer" confirmLabel="Borrar" cancelLabel="Cancelar" onConfirm={vi.fn()} onCancel={vi.fn()} isDestructive />
    )
    const dialog = screen.getByRole('alertdialog', { name: '¿Borrar?' })
    expect(dialog).toHaveAccessibleDescription('No se puede deshacer')
    await waitFor(() => expect(document.activeElement).toHaveTextContent('Cancelar'))
  })
})
