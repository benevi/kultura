// ============================================================
// KULTURA — DiscoverGroupsClient unit tests
// Verifica fetch inicial, render de GroupCard, empty state,
// mapeo de filtro UI→API (scope) y paginación "cargar más".
// ============================================================

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

// FilterBar v3 = TODO popover (incl. single como 'scope'). Radix Popover toca
// APIs del DOM que jsdom no trae; polyfill mínimo para poder abrir el popover.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture)
    Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture)
    Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture)
    Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView)
    Element.prototype.scrollIntoView = () => {}
})

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params && 'count' in params) return `${key}:${params.count}`
    return key
  },
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

import { DiscoverGroupsClient } from '@/app/[locale]/(app)/groups/DiscoverGroupsClient'

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeGroup(i: number, isMember = false) {
  return {
    id: `g-${i}`,
    name: `Group ${i}`,
    description: `Desc ${i}`,
    coverColor: '#E82020',
    memberCount: i,
    isMember,
  }
}

function okJson(groups: unknown[]) {
  return { ok: true, json: async () => ({ groups }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DiscoverGroupsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches on mount (after debounce) and renders GroupCards', async () => {
    mockFetch.mockResolvedValueOnce(okJson([makeGroup(1, true), makeGroup(2)]))
    render(<DiscoverGroupsClient />)

    // Debounce 400ms antes del primer fetch.
    await vi.advanceTimersByTimeAsync(400)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Group 1')).toBeInTheDocument()
    expect(screen.getByText('Group 2')).toBeInTheDocument()
    // Badge "ya eres miembro" solo en el grupo isMember.
    expect(screen.getByText('alreadyMember')).toBeInTheDocument()
  })

  it('shows empty state when no groups returned', async () => {
    mockFetch.mockResolvedValueOnce(okJson([]))
    render(<DiscoverGroupsClient />)

    await vi.advanceTimersByTimeAsync(400)

    expect(screen.getByText('noGroupsFound')).toBeInTheDocument()
  })

  it('maps "I am a member" filter to scope=joined in the API call', async () => {
    mockFetch.mockResolvedValue(okJson([]))
    render(<DiscoverGroupsClient />)
    await vi.advanceTimersByTimeAsync(400)

    // FilterBar v3: scope (single) es popover. Abrir el trigger y luego clicar
    // la opción scopeMember (mapea a scope=joined).
    fireEvent.click(screen.getByRole('button', { name: 'scope' }))
    fireEvent.click(screen.getByText('scopeMember'))
    await vi.advanceTimersByTimeAsync(400)

    const lastUrl = mockFetch.mock.calls.at(-1)![0] as string
    expect(lastUrl).toContain('scope=joined')
  })

  it('shows "load more" and appends next page when full page returned', async () => {
    const firstPage = Array.from({ length: 50 }, (_, i) => makeGroup(i + 1))
    mockFetch.mockResolvedValueOnce(okJson(firstPage))
    render(<DiscoverGroupsClient />)
    await vi.advanceTimersByTimeAsync(400)

    const loadMore = screen.getByText('loadMore')
    expect(loadMore).toBeInTheDocument()

    mockFetch.mockResolvedValueOnce(okJson([makeGroup(51)]))
    fireEvent.click(loadMore)
    // Load-more no tiene debounce; flush microtasks de la promesa fetch.
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByText('Group 51')).toBeInTheDocument()

    // offset=50 en la segunda llamada.
    const lastUrl = mockFetch.mock.calls.at(-1)![0] as string
    expect(lastUrl).toContain('offset=50')
  })
})
