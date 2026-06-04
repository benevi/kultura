// ============================================================
// KULTURA — InviteButton unit tests (E45-d.2)
// El botón abre el modal de invitación. El gate isOwner vive en
// el server component (groups/[id]/page.tsx); aquí verificamos
// que el botón renderiza y abre/cierra el modal.
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: vi.fn(), dismiss: vi.fn() }),
}))

import { InviteButton } from '@/app/[locale]/(app)/groups/[id]/InviteButton'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InviteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ friends: [] }) })
  })

  it('renderiza el botón Invitar', () => {
    render(<InviteButton groupId="g1" />)
    expect(screen.getByText('invite')).toBeInTheDocument()
  })

  it('no muestra el modal inicialmente', () => {
    render(<InviteButton groupId="g1" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('click abre el modal de invitación', async () => {
    render(<InviteButton groupId="g1" />)
    fireEvent.click(screen.getByText('invite'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText('inviteFriends')).toBeInTheDocument()
  })

  it('cierra el modal al hacer click en overlay', async () => {
    render(<InviteButton groupId="g1" />)
    fireEvent.click(screen.getByText('invite'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('modal-overlay'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
