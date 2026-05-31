// ============================================================
// KULTURA — GroupsClient unit tests
// Verifica tabs, render de "mis grupos", botón crear visible y
// el toggle del form de creación.
// ============================================================

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ groups: [] }) })
global.fetch = mockFetch

import { GroupsClient, type MyGroup } from '@/app/[locale]/(app)/groups/GroupsClient'

const myGroups: MyGroup[] = [
  { id: 'g1', name: 'Cinéfilos', description: 'Cine', coverColor: '#E82020', memberRole: 'owner' },
  { id: 'g2', name: 'Lectores', description: null, coverColor: '#2050E8', memberRole: 'member' },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GroupsClient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders both tabs', () => {
    render(<GroupsClient myGroups={myGroups} />)
    expect(screen.getByText('myGroupsTab')).toBeInTheDocument()
    expect(screen.getByText('discoverTab')).toBeInTheDocument()
  })

  it('renders my groups list on the default tab', () => {
    render(<GroupsClient myGroups={myGroups} />)
    expect(screen.getByText('Cinéfilos')).toBeInTheDocument()
    expect(screen.getByText('Lectores')).toBeInTheDocument()
  })

  it('shows the create-group button and toggles the form', () => {
    render(<GroupsClient myGroups={myGroups} />)
    const createBtn = screen.getByRole('button', { name: /createGroup/i })
    expect(createBtn).toBeInTheDocument()

    // El form no está hasta hacer click (placeholder del nombre).
    expect(screen.queryByPlaceholderText('groupNamePlaceholder')).not.toBeInTheDocument()
    fireEvent.click(createBtn)
    expect(screen.getByPlaceholderText('groupNamePlaceholder')).toBeInTheDocument()
  })

  it('shows empty state when there are no groups', () => {
    render(<GroupsClient myGroups={[]} />)
    expect(screen.getByText('noGroups')).toBeInTheDocument()
  })

  it('switches to the discover tab', () => {
    render(<GroupsClient myGroups={myGroups} />)
    fireEvent.click(screen.getByText('discoverTab'))
    // DiscoverGroupsClient renderiza el search input.
    expect(screen.getByPlaceholderText('searchPlaceholder')).toBeInTheDocument()
  })
})
