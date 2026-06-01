// ============================================================
// KULTURA — CreateGroupForm unit tests
// Verifica que el toggle de visibilidad envía is_public en el POST.
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const mockFetch = vi
  .fn()
  .mockResolvedValue({ ok: true, json: async () => ({ group: { id: 'g1', name: 'X' } }) })
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
})
