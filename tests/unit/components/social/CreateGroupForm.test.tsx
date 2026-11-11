// ============================================================
// KULTURA — CreateGroupForm unit tests
// Verifica que el toggle de visibilidad envía is_public en el POST y que
// onCreated recibe el grupo ya mapeado (data de POST /api/groups).
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns === 'auth' ? `auth.${key}` : key),
}))

const CREATED = {
  id: 'g1',
  ownerId: 'me',
  name: 'Cinéfilos',
  description: null,
  coverColor: 'var(--accent-pink)',
  icon: null,
  isPublic: true,
  createdAt: '2026-01-01T00:00:00Z',
  memberRole: 'owner',
}
const mockFetch = vi
  .fn()
  .mockResolvedValue({ ok: true, status: 201, json: async () => ({ data: CREATED }) })
global.fetch = mockFetch as unknown as typeof fetch

import { CreateGroupForm } from '@/components/social/CreateGroupForm'

function bodyOf(call: unknown[]): Record<string, unknown> {
  const init = call[1] as RequestInit
  return JSON.parse(init.body as string)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateGroupForm', () => {
  beforeEach(() => vi.clearAllMocks())

  function fillName() {
    fireEvent.change(screen.getByPlaceholderText('groupNamePlaceholder'), {
      target: { value: 'Cinéfilos' },
    })
  }

  it('sends is_public: true by default', async () => {
    render(<CreateGroupForm onCreated={vi.fn()} onCancel={vi.fn()} />)
    fillName()
    fireEvent.click(screen.getByRole('button', { name: /createGroup/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(bodyOf(mockFetch.mock.calls[0]).is_public).toBe(true)
  })

  it('llama a onCreated con el grupo mapeado de data', async () => {
    const onCreated = vi.fn()
    render(<CreateGroupForm onCreated={onCreated} onCancel={vi.fn()} />)
    fillName()
    fireEvent.click(screen.getByRole('button', { name: /createGroup/i }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREATED))
    expect(mockFetch).toHaveBeenCalledWith('/api/groups', expect.objectContaining({ method: 'POST' }))
  })

  it('sends is_public: false when private is selected', async () => {
    render(<CreateGroupForm onCreated={vi.fn()} onCancel={vi.fn()} />)
    fillName()
    fireEvent.click(screen.getByRole('button', { name: 'private' }))
    fireEvent.click(screen.getByRole('button', { name: /createGroup/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(bodyOf(mockFetch.mock.calls[0]).is_public).toBe(false)
  })

  it('shows the private hint only when private is selected', () => {
    render(<CreateGroupForm onCreated={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByText('privateHint')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'private' }))
    expect(screen.getByText('privateHint')).toBeInTheDocument()
  })

  // Los personajes del icono del grupo, con su nombre traducido (no la clave «fox»).
  it('nombra los personajes con auth.characters.*', () => {
    render(<CreateGroupForm onCreated={vi.fn()} onCancel={vi.fn()} />)
    const radios = screen.getAllByRole('radio').slice(1)
    expect(radios.length).toBeGreaterThan(0)
    for (const radio of radios) expect(radio.getAttribute('aria-label')).toMatch(/^auth\.characters\./)
    expect(screen.getByRole('radio', { name: 'auth.characters.fox' })).toBeInTheDocument()
  })
})
