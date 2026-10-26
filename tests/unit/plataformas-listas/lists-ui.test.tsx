// ============================================================
// F-25 (PRO-10) — Crear listas con plantilla, añadir a una mixta y ver la
// lista pública en el orden del dueño.
// ============================================================

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? ns + '.' : ''}${key}${values ? JSON.stringify(values) : ''}`,
}))
const mockPush = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: vi.fn(), showError: vi.fn(), dismiss: vi.fn() }),
}))

import { CreateListModal } from '@/components/social/CreateListModal'
import { AddToListButton } from '@/components/social/AddToListButton'
import type { MediaItem } from '@/types/media'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  delete process.env.MIXED_LISTS
})

const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body)

describe('CreateListModal con MIXED_LISTS', () => {
  it('sin la bandera: ni plantillas, ni «Varios formatos», ni descripción', () => {
    render(<CreateListModal onClose={vi.fn()} />)
    expect(screen.queryByRole('group', { name: 'lists.templateLabel' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'lists.descriptionLabel' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'lists.mediaTypeMixed' })).toBeNull()
  })

  it('«Franquicia» crea una lista mixta con su plantilla y descripción', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ list: { id: 'dune' } }) })
    render(<CreateListModal onClose={vi.fn()} mixedEnabled />)
    const group = screen.getByRole('group', { name: 'lists.templateLabel' })
    expect(within(group).getByRole('radio', { name: /lists\.template\.free/ })).toBeChecked()
    fireEvent.click(within(group).getByRole('radio', { name: /lists\.template\.franchise/ }))
    // El tipo queda fijo (mixta): ya no hay selector.
    expect(screen.queryByRole('combobox', { name: 'lists.mediaType' })).toBeNull()
    expect(screen.getByRole('textbox', { name: 'lists.listName' })).toHaveAttribute('placeholder', 'lists.franchiseNamePlaceholder')
    fireEvent.change(screen.getByRole('textbox', { name: 'lists.listName' }), { target: { value: 'Dune' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'lists.descriptionLabel' }), { target: { value: 'Libro, pelis y juego' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.create' }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/lists/dune'))
    expect(sent()).toEqual({
      name: 'Dune', mediaType: 'mixed', isCollaborative: false, isPublic: false,
      description: 'Libro, pelis y juego', template: 'franchise',
    })
  })

  it('«Ranking personal» conserva el formato elegido', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ list: { id: 'top' } }) })
    render(<CreateListModal onClose={vi.fn()} mixedEnabled />)
    fireEvent.click(screen.getByRole('radio', { name: /lists\.template\.ranking/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'lists.listName' }), { target: { value: 'Top' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.create' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(sent()).toMatchObject({ mediaType: 'movie', template: 'ranking' })
    expect(sent()).not.toHaveProperty('description')
  })

  it('mixed_unavailable (bandera antes de migrar): aviso específico en el diálogo', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'mixed_unavailable' }) })
    render(<CreateListModal onClose={vi.fn()} mixedEnabled />)
    fireEvent.click(screen.getByRole('radio', { name: /lists\.template\.franchise/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'lists.listName' }), { target: { value: 'Dune' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.create' }))
    await waitFor(() =>
      expect(screen.getAllByRole('alert').some((a) => a.textContent === 'lists.errorMixedUnavailable')).toBe(true),
    )
  })
})

describe('AddToListButton', () => {
  const BOOK: MediaItem = { id: 'book_dune', externalId: 'dune', type: 'book', title: 'Dune' }

  it('una lista mixta admite un libro; una de películas, no', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lists: [
          { id: 'l1', name: 'Pelis', media_type: 'movie', is_collaborative: false },
          { id: 'l2', name: 'Dune', media_type: 'mixed', is_collaborative: false },
        ],
      }),
    })
    render(<AddToListButton item={BOOK} />)
    fireEvent.click(screen.getByRole('button', { name: 'lists.addToList' }))
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Dune' })).toBeInTheDocument())
    expect(screen.queryByRole('radio', { name: 'Pelis' })).toBeNull()
  })
})

// ── Página pública /u/[username]/l/[id] ──────────────────────────────────────

const h = vi.hoisted(() => ({
  extras: null as unknown,
  list: null as unknown,
}))

vi.mock('next/navigation', () => ({ permanentRedirect: vi.fn(), notFound: vi.fn(() => { throw new Error('NOT_FOUND') }) }))
vi.mock('next-intl/server', () => ({
  getTranslations: async (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${typeof ns === 'string' ? ns + '.' : ''}${key}${values ? JSON.stringify(values) : ''}`,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock('@/lib/social/public-collection', () => ({
  getPublicList: async () => h.list,
  usernameExists: async () => true,
  resolveRenamedUsername: async () => null,
}))
vi.mock('@/lib/social/lists', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/social/lists')>()),
  getPublicListExtras: async () => h.extras,
}))
vi.mock('@/lib/social/friends', () => ({ isModerationV2: () => true }))
vi.mock('@/components/layout/Header', () => ({ Header: () => null }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }))

function find(node: ReactNode, pred: (el: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = find(n, pred)
      if (f) return f
    }
    return null
  }
  if (!isValidElement(node)) return null
  const el = node as ReactElement<Record<string, unknown>>
  if (pred(el)) return el
  return find(el.props.children as ReactNode, pred)
}

describe('lista pública en el orden del dueño', () => {
  const LIST = {
    owner: { id: 'o1', username: 'ana', avatarColor: 'blue', avatarInitials: 'AN', avatarIcon: null, bio: null },
    list: {
      id: '11111111-1111-1111-1111-111111111111', name: 'Dune', mediaType: 'mixed',
      // getPublicList las trae por fecha (la más reciente primero).
      items: [
        { mediaId: 'game_1', title: 'Dune: Awakening', poster: null, type: 'game' },
        { mediaId: 'movie_2', title: 'Dune (2021)', poster: null, type: 'movie' },
        { mediaId: 'book_3', title: 'Dune', poster: null, type: 'book' },
      ],
    },
  }
  async function page() {
    const { default: Page } = await import('@/app/[locale]/u/[username]/l/[id]/page')
    return Page({ params: Promise.resolve({ locale: 'es', username: 'ana', id: LIST.list.id }) })
  }

  it('con extras: OrderedListGrid con el orden de `position`, notas, descripción y ranking', async () => {
    h.list = LIST
    h.extras = {
      description: 'De los libros al juego',
      template: 'ranking',
      items: new Map([
        ['book_3', { position: 0, note: 'Empieza aquí' }],
        ['movie_2', { position: 1, note: null }],
        ['game_1', { position: 2, note: null }],
      ]),
    }
    const tree = await page()
    const grid = find(tree as ReactNode, (el) => typeof el.type === 'function' && (el.type as { name?: string }).name === 'OrderedListGrid')
    expect(grid).not.toBeNull()
    const entries = grid!.props.entries as Array<{ item: { id: string }; note: string | null }>
    expect(entries.map((e) => e.item.id)).toEqual(['book_3', 'movie_2', 'game_1'])
    expect(entries[0].note).toBe('Empieza aquí')
    expect(grid!.props.ranked).toBe(true)
    expect(find(tree as ReactNode, (el) => el.props.children === 'De los libros al juego')).not.toBeNull()
    // El formato «mixed» se rotula, no se busca en `media`.
    const label = find(tree as ReactNode, (el) => (el.type as { name?: string }).name === 'FormatLabel')
    expect(label?.props.children).toBe('lists.mediaTypeMixed')
  })

  it('sin extras (bandera apagada o sin migrar): la rejilla de siempre', async () => {
    h.list = { ...LIST, list: { ...LIST.list, mediaType: 'movie' } }
    h.extras = null
    const tree = await page()
    expect(find(tree as ReactNode, (el) => (el.type as { name?: string }).name === 'OrderedListGrid')).toBeNull()
    expect(find(tree as ReactNode, (el) => (el.type as { name?: string }).name === 'MediaGrid')).not.toBeNull()
  })
})
