// ============================================================
// KULTURA — Listas: HTML y comportamiento de ListDetail (caracterización, C12).
//
// Fija el marcado (textos, clases, orden, ids, aria) en las vistas del dueño,
// de quien colabora y de un visitante, y qué llamada al servidor hace cada
// control (privacidad, borrar la lista, quitar títulos, invitar y quitar
// miembros, descripción, ordenar), para partir el componente sin cambiar nada.
// Las piezas que no se parten (MediaCard, ReorderableItems, ItemNote,
// ShareLinkButton) se sustituyen por dobles que enseñan lo que reciben.
// ============================================================

import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { List, ListItem, ListMember } from '@/types/list'

const { client, router, log, reorderCallbacks } = vi.hoisted(() => ({
  reorderCallbacks: [] as unknown[],
  client: {
    deleteList: vi.fn(),
    inviteListMember: vi.fn(),
    removeListItem: vi.fn(),
    removeListMember: vi.fn(),
    updateList: vi.fn(),
  },
  router: { push: vi.fn(), refresh: vi.fn() },
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${values ? `(${Object.values(values).join(',')})` : ''}`,
  useLocale: () => 'es',
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  useRouter: () => router,
}))
vi.mock('@/lib/lists/client', () => client)
vi.mock('@/lib/logger', () => ({ createLogger: () => log }))
vi.mock('@/components/media/MediaCard', () => ({
  MediaCard: ({ item }: { item: { id: string; title: string } }) => <div data-media-card={item.id}>{item.title}</div>,
}))
vi.mock('@/components/social/ShareLinkButton', () => ({
  ShareLinkButton: ({ path, title, label }: { path: string; title: string; label: string }) => (
    <button type="button" data-share-path={path} data-share-title={title}>{label}</button>
  ),
}))
vi.mock('@/app/[locale]/(app)/lists/[id]/ItemNote', () => ({
  ItemNote: ({ listId, item, editable }: { listId: string; item: { id: string; note: string }; editable: boolean }) => (
    <p data-note-list={listId} data-note-item={item.id} data-editable={String(editable)}>{item.note}</p>
  ),
}))
vi.mock('@/app/[locale]/(app)/lists/[id]/ReorderableItems', () => ({
  ReorderableItems: ({ listId, items, onItemsChange, ranked }: {
    listId: string
    items: Array<{ id: string }>
    onItemsChange: (next: unknown[]) => void
    ranked: boolean
  }) => {
    reorderCallbacks.push(onItemsChange)
    return (
    <div data-reorderable={listId} data-ranked={String(ranked)}>
      {items.map((i) => i.id).join(',')}
      <button type="button" onClick={() => onItemsChange([...items].reverse())}>invertir</button>
    </div>
    )
  },
}))

import { renderToString } from 'react-dom/server'
import { ApiError } from '@/lib/api/client'
import { ListDetail } from '@/app/[locale]/(app)/lists/[id]/ListDetail'

const OWNER = { id: 'u1', username: 'ana', avatarColor: 'pink', avatarInitials: 'AN', createdAt: '' }
const BEA = { id: 'u2', username: 'bea', avatarColor: 'lime', avatarInitials: 'BE', createdAt: '' }

function makeList(over: Partial<List> = {}): List {
  return {
    id: 'l1',
    ownerId: 'u1',
    name: 'Maratón de terror',
    mediaType: 'movie',
    isCollaborative: true,
    isPublic: true,
    createdAt: '',
    description: 'Para octubre.\nSin spoilers.',
    template: 'ranking',
    owner: OWNER as never,
    ...over,
  }
}

const ITEMS: ListItem[] = [
  { id: 'i1', listId: 'l1', mediaId: 'movie_1', addedAt: '', note: 'La mejor', media: { id: 'movie_1', title: 'Alien' } as never },
  { id: 'i2', listId: 'l1', mediaId: 'movie_2', addedAt: '', note: null, media: { id: 'movie_2', title: 'Halloween' } as never },
  { id: 'i3', listId: 'l1', mediaId: 'movie_3', addedAt: '' },
]

const MEMBERS: ListMember[] = [
  { listId: 'l1', userId: 'u2', user: BEA as never },
  { listId: 'l1', userId: 'u4' } as ListMember,
]

const FRIENDS = [
  { id: 'u2', username: 'bea', avatarColor: 'lime', avatarInitials: 'BE' },
  { id: 'u3', username: 'carlos', avatarColor: 'blue', avatarInitials: 'CA' },
  { id: 'u5', username: 'dani', avatarColor: 'violet', avatarInitials: 'DA' },
]

type Props = React.ComponentProps<typeof ListDetail>

function setup(over: Partial<Props> = {}) {
  const props: Props = {
    list: makeList(),
    items: ITEMS,
    members: MEMBERS,
    currentUserId: 'u1',
    currentUserFriends: FRIENDS,
    canEdit: true,
    ...over,
  }
  return render(<ListDetail {...props} />)
}

/** Los ids de `useId` en cliente salen de un contador global: se normalizan. */
const norm = (html: string) => html.replace(/_r_[0-9a-z]+_/g, '_r_X_')

function deferred<T = unknown>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  reorderCallbacks.length = 0
  for (const fn of Object.values(client)) fn.mockResolvedValue(null)
})

describe('ListDetail — HTML', () => {
  it('dueño de una lista colaborativa, pública, en ranking y con descripción', () => {
    const { container } = setup()
    expect(norm(container.innerHTML)).toMatchSnapshot()
  })

  it('visitante de una lista privada, de varios formatos y sin plantilla', () => {
    const { container } = setup({
      list: makeList({ isPublic: false, isCollaborative: false, mediaType: 'mixed', template: null, description: null }),
      currentUserId: 'u9',
      currentUserFriends: [],
      canEdit: false,
    })
    expect(norm(container.innerHTML)).toMatchSnapshot()
  })

  it('quien colabora sin ser dueño (puede editar, no administra)', () => {
    const { container } = setup({ currentUserId: 'u2', canEdit: true, list: makeList({ template: 'franchise' }) })
    expect(norm(container.innerHTML)).toMatchSnapshot()
  })

  it('lista vacía, colaborativa, sin dueño embebido y sin sesión', () => {
    const { container } = setup({
      list: makeList({ owner: undefined, isPublic: true, description: '' }),
      items: [],
      currentUserId: '',
      currentUserFriends: [],
      canEdit: false,
    })
    expect(norm(container.innerHTML)).toMatchSnapshot()
  })

  it('dueño con la lista vacía (sin botón de ordenar)', () => {
    const { container } = setup({ items: [], list: makeList({ isCollaborative: false, description: '' }) })
    expect(norm(container.innerHTML)).toMatchSnapshot()
  })

  it('pública pero sin dueño embebido: no hay enlace para compartir', () => {
    setup({ list: makeList({ owner: undefined }) })
    expect(screen.queryByRole('button', { name: 'collection.share' })).toBeNull()
    expect(screen.getByText('collection.publicHint')).toBeInTheDocument()
  })

  it('editando la descripción', () => {
    const { container } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.editDescription' }))
    expect(norm(container.innerHTML)).toMatchSnapshot()
    // Sin normalizar: la etiqueta y la pista apuntan al campo de verdad.
    const field = container.querySelector('textarea')!
    const label = container.querySelector('form label') as HTMLLabelElement
    expect(field.id).not.toBe('')
    expect(label.htmlFor).toBe(field.id)
    const hint = document.getElementById(field.getAttribute('aria-describedby')!)
    expect(hint).toHaveTextContent('lists.descriptionHint(473)')
    expect(hint?.id).not.toBe(field.id)
  })

  it('ordenando', () => {
    const { container } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.reorder' }))
    expect(norm(container.innerHTML)).toMatchSnapshot()
  })

  it('SSR de la vista del dueño (ids de useId sin normalizar)', () => {
    const html = renderToString(
      <ListDetail
        list={makeList()}
        items={ITEMS}
        members={MEMBERS}
        currentUserId="u1"
        currentUserFriends={FRIENDS}
        canEdit
      />
    )
    expect(html).toMatchSnapshot()
  })

  it('diálogo de borrar abierto', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.deleteList' }))
    expect(norm(document.body.innerHTML)).toMatchSnapshot()
  })
})

describe('ListDetail — privacidad y compartir', () => {
  it('colaborativa pública vista por quien no es dueño ni miembro: ni sección «Miembros» ni avatares', () => {
    setup({ currentUserId: 'u9', canEdit: false, currentUserFriends: [] })
    expect(screen.queryByRole('heading', { name: 'lists.membersTitle' })).toBeNull()
    expect(screen.queryByText('bea')).toBeNull()
    expect(screen.queryByText('BE')).toBeNull()
  })

  it('un miembro sí ve la sección «Miembros»', () => {
    setup({ currentUserId: 'u2', canEdit: true })
    expect(screen.getByRole('heading', { name: 'lists.membersTitle' })).toBeInTheDocument()
    expect(screen.getByText('bea')).toBeInTheDocument()
  })

  it('pasar a privada llama a updateList y quita el botón de compartir', async () => {
    setup()
    expect(screen.getByRole('button', { name: 'collection.share' })).toHaveAttribute('data-share-path', '/u/ana/l/l1')
    expect(screen.getByRole('button', { name: 'collection.share' })).toHaveAttribute('data-share-title', 'Maratón de terror')
    fireEvent.click(screen.getByRole('radio', { name: 'collection.private' }))
    expect(screen.getByRole('radio', { name: 'collection.private' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('button', { name: 'collection.share' })).toBeNull()
    expect(screen.getByText('collection.privateHint')).toBeInTheDocument()
    await waitFor(() => expect(client.updateList).toHaveBeenCalledWith('l1', { isPublic: false }))
    expect(client.updateList).toHaveBeenCalledTimes(1)
  })

  it('elegir el valor actual no llama al servidor', () => {
    setup()
    fireEvent.click(screen.getByRole('radio', { name: 'collection.public' }))
    expect(client.updateList).not.toHaveBeenCalled()
  })

  it('mientras guarda, otro cambio se ignora', async () => {
    const d = deferred()
    client.updateList.mockReturnValueOnce(d.promise)
    setup()
    fireEvent.click(screen.getByRole('radio', { name: 'collection.private' }))
    fireEvent.click(screen.getByRole('radio', { name: 'collection.public' }))
    expect(client.updateList).toHaveBeenCalledTimes(1)
    await act(async () => { d.resolve(null) })
  })

  it('si falla, vuelve atrás, avisa y lo registra', async () => {
    client.updateList.mockRejectedValueOnce(new Error('boom'))
    setup()
    fireEvent.click(screen.getByRole('radio', { name: 'collection.private' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('collection.visibilityError')
    expect(screen.getByRole('radio', { name: 'collection.public' })).toHaveAttribute('aria-checked', 'true')
    expect(log.error).toHaveBeenCalledWith('visibility change failed', { message: 'boom' })
  })

  it('un visitante no ve los controles de privacidad ni de borrar', () => {
    setup({ currentUserId: 'u9', canEdit: false })
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('button', { name: 'lists.deleteList' })).toBeNull()
    expect(screen.queryByRole('button', { name: /lists\.removeItemNamed/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'lists.reorder' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'lists.removeMember' })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})

describe('ListDetail — borrar la lista', () => {
  it('confirmar borra, va a /lists y refresca', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.deleteList' }))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'common.confirm' }))
    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
    expect(client.deleteList).toHaveBeenCalledWith('l1')
    expect(router.push).toHaveBeenCalledWith('/lists')
  })

  it('cancelar cierra sin borrar', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.deleteList' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'common.cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(client.deleteList).not.toHaveBeenCalled()
  })

  it('si falla, avisa y el diálogo sigue abierto y usable', async () => {
    client.deleteList.mockRejectedValueOnce(new Error('x'))
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.deleteList' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'common.confirm' }))
    expect(await screen.findByText('lists.errorDelete')).toHaveAttribute('role', 'alert')
    expect(router.push).not.toHaveBeenCalled()
    const confirm = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'common.confirm' })
    expect(confirm).not.toBeDisabled()
  })
})

describe('ListDetail — títulos', () => {
  it('quitar un título lo saca de la rejilla y del contador', async () => {
    const { container } = setup()
    const meta = () => container.querySelector('header span.text-meta')?.textContent
    expect(meta()).toContain('lists.itemCount(3)')
    fireEvent.click(screen.getByRole('button', { name: 'lists.removeItemNamed(Halloween)' }))
    await waitFor(() => expect(screen.queryByText('Halloween')).toBeNull())
    expect(client.removeListItem).toHaveBeenCalledWith('l1', 'i2')
    expect(meta()).toContain('lists.itemCount(2)')
    expect(screen.getByText('lists.rankPosition(2)')).toBeInTheDocument()
    expect(screen.queryByText('lists.rankPosition(3)')).toBeNull()
  })

  it('el botón se desactiva mientras se quita y usa el mediaId sin título', async () => {
    const d = deferred()
    client.removeListItem.mockReturnValueOnce(d.promise)
    setup()
    const btn = screen.getByRole('button', { name: 'lists.removeItemNamed(movie_3)' })
    fireEvent.click(btn)
    expect(btn).toBeDisabled()
    expect(screen.getByRole('button', { name: 'lists.removeItemNamed(Alien)' })).not.toBeDisabled()
    await act(async () => { d.resolve(null) })
    expect(screen.queryByRole('button', { name: 'lists.removeItemNamed(movie_3)' })).toBeNull()
  })

  it('si falla, avisa, lo registra y el título sigue', async () => {
    const err = new Error('x')
    client.removeListItem.mockRejectedValueOnce(err)
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.removeItemNamed(Alien)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('lists.removeError')
    expect(screen.getByText('Alien')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'lists.removeItemNamed(Alien)' })).not.toBeDisabled()
    expect(log.error).toHaveBeenCalledWith('Failed to remove item', { err })
  })

  it('el error anterior se borra al empezar otra acción', async () => {
    client.removeListItem.mockRejectedValueOnce(new Error('x'))
    const d = deferred()
    client.removeListItem.mockReturnValueOnce(d.promise)
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.removeItemNamed(Alien)' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'lists.removeItemNamed(Alien)' }))
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => { d.resolve(null) })
  })

  it('ordenar: pasa los títulos a ReorderableItems y recoge el orden nuevo', () => {
    setup()
    const toggle = screen.getByRole('button', { name: 'lists.reorder' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    const done = screen.getByRole('button', { name: 'lists.reorderDone' })
    expect(done).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/i1,i2,i3/).closest('[data-reorderable]')).toHaveAttribute('data-ranked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'invertir' }))
    expect(screen.getByText(/i3,i2,i1/)).toBeInTheDocument()
    // onItemsChange es estable entre renders (useCallback): no reinicia ReorderableItems.
    expect(reorderCallbacks.length).toBeGreaterThan(1)
    expect(new Set(reorderCallbacks).size).toBe(1)
    fireEvent.click(done)
    const cards = Array.from(document.querySelectorAll('ol > li')).map((li) => li.textContent)
    expect(cards[0]).toContain('movie_3')
    expect(cards[2]).toContain('Alien')
  })

  it('sin permiso de edición no hay botón de quitar ni de ordenar', () => {
    setup({ canEdit: false, currentUserId: 'u1' })
    expect(screen.queryByRole('button', { name: /lists\.removeItemNamed/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'lists.reorder' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'lists.addItem' })).toBeNull()
  })
})

describe('ListDetail — miembros', () => {
  it('invitar añade al miembro, vacía el selector y lo saca de las opciones', async () => {
    setup()
    const select = screen.getByRole('combobox', { name: 'lists.inviteMember' })
    expect(select).toHaveAttribute('id', 'invite-l1')
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.value)).toEqual(['', 'u3', 'u5'])
    const invite = screen.getByRole('button', { name: 'lists.invite' })
    expect(invite).toBeDisabled()
    fireEvent.change(select, { target: { value: 'u3' } })
    expect(invite).not.toBeDisabled()
    fireEvent.click(invite)
    await waitFor(() => expect(screen.getByRole('link', { name: 'carlos' })).toHaveAttribute('href', '/profile/carlos'))
    expect(client.inviteListMember).toHaveBeenCalledWith('l1', 'u3')
    expect((select as HTMLSelectElement).value).toBe('')
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.value)).toEqual(['', 'u5'])
  })

  it('cuando no quedan amigos que invitar, desaparece el selector', async () => {
    setup({ currentUserFriends: [FRIENDS[0], FRIENDS[1]] })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u3' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.invite' }))
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull())
  })

  it('si no es amigo, lo dice y no lo registra como fallo', async () => {
    client.inviteListMember.mockRejectedValueOnce(new ApiError('forbidden', 403, { message: 'not_friends' }))
    setup()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u3' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.invite' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('lists.inviteNotFriend')
    expect(log.error).not.toHaveBeenCalled()
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('u3')
  })

  it('otro fallo al invitar: aviso genérico y registro', async () => {
    const err = new ApiError('forbidden', 403, { message: 'otra' })
    client.inviteListMember.mockRejectedValueOnce(err)
    setup()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u3' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.invite' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('lists.inviteError')
    expect(log.error).toHaveBeenCalledWith('Failed to invite member', { err })
  })

  it('quitar a un miembro lo saca de la lista y de los avatares', async () => {
    const { container } = setup()
    expect(container.querySelectorAll('header [class~="ring-surface-base"]').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'lists.removeMember' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'bea' })).toBeNull())
    expect(client.removeListMember).toHaveBeenCalledWith('l1', 'u2')
    expect(container.querySelectorAll('header [class~="ring-surface-base"]').length).toBe(1)
  })

  it('si falla quitar a un miembro, avisa y lo registra', async () => {
    const err = new Error('x')
    client.removeListMember.mockRejectedValueOnce(err)
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.removeMember' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('lists.removeMemberError')
    expect(screen.getByRole('link', { name: 'bea' })).toBeInTheDocument()
    expect(log.error).toHaveBeenCalledWith('Failed to remove member', { err })
  })
})

describe('ListDetail — descripción', () => {
  it('abrir el editor enfoca el campo con el texto actual', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.editDescription' }))
    const field = screen.getByRole('textbox', { name: 'lists.descriptionLabel' })
    expect(field).toHaveFocus()
    expect(field).toHaveValue('Para octubre.\nSin spoilers.')
    expect(field).toHaveAttribute('maxLength', '500')
    expect(screen.getByText('lists.descriptionHint(473)')).toBeInTheDocument()
    expect(screen.queryByText(/Para octubre/, { selector: 'p' })).toBeNull()
  })

  it('sin descripción, el botón dice «añadir»', () => {
    setup({ list: makeList({ description: null }) })
    expect(screen.getByRole('button', { name: 'lists.addDescription' })).toBeInTheDocument()
  })

  it('guardar envía el borrador tal cual y muestra el texto recortado', async () => {
    setup({ list: makeList({ description: null }) })
    fireEvent.click(screen.getByRole('button', { name: 'lists.addDescription' }))
    const field = screen.getByRole('textbox')
    fireEvent.change(field, { target: { value: '  Nueva  ' } })
    expect(screen.getByText('lists.descriptionHint(491)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'lists.descriptionSave' }))
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
    expect(client.updateList).toHaveBeenCalledWith('l1', { description: '  Nueva  ' })
    expect(screen.getByText('Nueva').textContent).toBe('Nueva')
    expect(screen.getByRole('button', { name: 'lists.editDescription' })).toBeInTheDocument()
  })

  it('si falla, avisa dentro del formulario y marca el campo', async () => {
    client.updateList.mockRejectedValueOnce(new Error('nope'))
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.editDescription' }))
    fireEvent.click(screen.getByRole('button', { name: 'lists.descriptionSave' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('lists.descriptionError')
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    expect(log.error).toHaveBeenCalledWith('description save failed', { message: 'nope' })
    // Cancelar y volver a abrir limpia el error.
    fireEvent.click(screen.getByRole('button', { name: 'lists.cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'lists.editDescription' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid')
  })

  it('cancelar descarta el borrador', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.editDescription' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'otra cosa' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.cancel' }))
    expect(client.updateList).not.toHaveBeenCalled()
    expect(screen.getByText(/Para octubre/)).toBeInTheDocument()
  })

  it('mientras guarda, cancelar está desactivado', async () => {
    const d = deferred()
    client.updateList.mockReturnValueOnce(d.promise)
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'lists.editDescription' }))
    fireEvent.click(screen.getByRole('button', { name: 'lists.descriptionSave' }))
    expect(screen.getByRole('button', { name: 'lists.cancel' })).toBeDisabled()
    await act(async () => { d.resolve(null) })
  })

  it('quien colabora sin ser dueño no puede editarla', () => {
    setup({ currentUserId: 'u2' })
    expect(screen.queryByRole('button', { name: 'lists.editDescription' })).toBeNull()
  })
})
