import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    if (params?.name) return `${key}:${params.name}`
    return key
  },
}))

const mockShow = vi.fn()
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: mockShow, dismiss: vi.fn() }),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

// ── Fixture ───────────────────────────────────────────────────────────────────

import { AddToListButton } from '@/components/social/AddToListButton'
import type { MediaItem } from '@/types/media'

const item: MediaItem = {
  id: 'movie_550',
  externalId: '550',
  type: 'movie',
  title: 'Fight Club',
  poster: '/poster.jpg',
  year: 1999,
}

function renderBtn() {
  return render(<AddToListButton item={item} />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AddToListButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders trigger button', () => {
    renderBtn()
    expect(screen.getByRole('button', { name: /addToList/i })).toBeInTheDocument()
  })

  it('shows noListsAtAll + CTA when user has no lists at all', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lists: [] }),
    })
    renderBtn()
    fireEvent.click(screen.getByRole('button', { name: /addToList/i }))
    await waitFor(() => {
      expect(screen.getByText('noListsAtAll')).toBeInTheDocument()
      expect(screen.getByText('createListCta')).toBeInTheDocument()
    })
  })

  it('shows noCompatibleLists when lists exist but none match item type', async () => {
    // API returns lists of type 'book', but item is type 'movie' → client filter → 0 compatible
    const lists = [{ id: 'list-2', name: 'Mis libros', media_type: 'book', is_collaborative: false }]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lists }),
    })
    renderBtn()
    fireEvent.click(screen.getByRole('button', { name: /addToList/i }))
    await waitFor(() => {
      expect(screen.getByText('noCompatibleLists')).toBeInTheDocument()
      expect(screen.queryByText('Mis libros')).not.toBeInTheDocument()
    })
  })

  it('shows list options and adds with success toast on 201', async () => {
    const lists = [{ id: 'list-1', name: 'Favs', media_type: 'movie', is_collaborative: false }]
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lists }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) })

    renderBtn()
    fireEvent.click(screen.getByRole('button', { name: /addToList/i }))
    await waitFor(() => expect(screen.getByText('Favs')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: /addButton/i }))

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      )
    })
  })

  it('shows info toast on 409 (already in list)', async () => {
    const lists = [{ id: 'list-1', name: 'Favs', media_type: 'movie', is_collaborative: false }]
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lists }) })
      .mockResolvedValueOnce({ ok: true, status: 409, json: async () => ({}) })

    renderBtn()
    fireEvent.click(screen.getByRole('button', { name: /addToList/i }))
    await waitFor(() => expect(screen.getByText('Favs')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: /addButton/i }))

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'info' })
      )
    })
  })

  it('cancel button closes modal without adding', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ lists: [] }) })
    renderBtn()
    fireEvent.click(screen.getByRole('button', { name: /addToList/i }))
    await waitFor(() => expect(screen.getByText('noListsAtAll')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByText('noListsAtAll')).not.toBeInTheDocument()
    })
    expect(mockShow).not.toHaveBeenCalled()
  })
})
