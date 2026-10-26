// ============================================================
// F-25 — ListDetail: formato «mixta», ranking numerado, notas, modo ordenar
// y el aviso cuando se invita a quien no es amigo.
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? ns + '.' : ''}${key}${values ? JSON.stringify(values) : ''}`,
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/components/media/MediaCard', () => ({
  MediaCard: ({ item }: { item: { title: string } }) => <span>{item.title}</span>,
}))
vi.mock('@/components/media/PosterImage', () => ({ PosterImage: () => null }))

import { ListDetail } from '@/app/[locale]/(app)/lists/[id]/ListDetail'
import type { List, ListItem } from '@/types/list'

const LIST: List = {
  id: 'l1', ownerId: 'u1', name: 'Dune', mediaType: 'mixed', isCollaborative: true, isPublic: false,
  createdAt: '', template: 'ranking', description: 'De los libros al juego',
  owner: { id: 'u1', username: 'ana', avatarColor: 'blue', avatarInitials: 'AN', createdAt: '' },
}
const item = (id: string, title: string, note: string | null = null): ListItem => ({
  id, listId: 'l1', mediaId: `book_${id}`, addedAt: '', position: null, note,
  media: { id: `book_${id}`, externalId: id, type: 'book', title },
})
const ITEMS = [item('a', 'Dune', 'Empieza aquí'), item('b', 'El mesías de Dune')]
const FRIENDS = [{ id: 'f1', username: 'lucia', avatarColor: 'blue', avatarInitials: 'LU' }]

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

function renderDetail(mixedEnabled = true, canEdit = true) {
  return render(
    <ListDetail
      list={LIST}
      items={ITEMS}
      members={[]}
      currentUserId="u1"
      currentUserFriends={FRIENDS}
      canEdit={canEdit}
      mixedEnabled={mixedEnabled}
    />,
  )
}

describe('ListDetail (F-25)', () => {
  it('cabecera: «Varios formatos», plantilla y descripción', () => {
    renderDetail()
    expect(screen.getByText('lists.mediaTypeMixed')).toBeInTheDocument()
    expect(screen.getByText(/lists\.template\.ranking/)).toBeInTheDocument()
    expect(screen.getByText('De los libros al juego')).toBeInTheDocument()
  })

  it('ranking: posición anunciada y número pintado; nota visible solo lectura', () => {
    renderDetail()
    expect(screen.getByText('lists.rankPosition{"position":1}')).toBeInTheDocument()
    expect(screen.getByText('Empieza aquí')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /addNoteNamed/ })).toBeNull()
  })

  it('«Ordenar y anotar» abre el modo con asas, Subir/Bajar y notas', () => {
    renderDetail()
    const toggle = screen.getByRole('button', { name: 'lists.reorder' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'lists.reorderDone' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { name: /lists\.dragHandle/ })).toHaveLength(2)
    expect(screen.getByRole('button', { name: /lists\.addNoteNamed.*mesías/ })).toBeInTheDocument()
  })

  it('sin la bandera: nada de ordenar, notas ni editar descripción', () => {
    renderDetail(false)
    expect(screen.queryByRole('button', { name: 'lists.reorder' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'lists.editDescription' })).toBeNull()
  })

  it('el dueño edita la descripción en línea', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'lists.editDescription' }))
    const field = screen.getByRole('textbox', { name: 'lists.descriptionLabel' })
    fireEvent.change(field, { target: { value: 'Todo Dune' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.descriptionSave' }))
    await waitFor(() => expect(screen.getByText('Todo Dune')).toBeInTheDocument())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ description: 'Todo Dune' })
  })

  it('invitar a quien ya no es amigo: el motivo, no un error genérico', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'not_friends' }) })
    renderDetail()
    fireEvent.change(screen.getByRole('combobox', { name: 'lists.inviteMember' }), { target: { value: 'f1' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.invite' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('lists.inviteNotFriend'))
  })
})
