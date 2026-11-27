// ============================================================
// KULTURA — «Invitar amigos» de /u (CRE-7) con la piel de «Sala» (8.5 P3):
// el mismo comportamiento (hoja nativa o copiar) con `SalaButton`, y el
// resultado anunciado en la región `status` de al lado.
// ============================================================

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => `invite.${key}` }))
vi.mock('@/components/sala/SalaButtonLazy', () => ({
  SalaButtonLazy: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" data-sala-button="" onClick={onClick}>
      {children}
    </button>
  ),
}))

import { InviteLinkButton } from '@/components/collection/InviteLinkButton'

beforeEach(() => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
})

describe('InviteLinkButton', () => {
  it('sin piel: el botón de hoy (KButton), sin «Sala»', () => {
    const { container } = render(<InviteLinkButton path="/es/u/ana?ref=ana&inv=x" />)
    expect(screen.getByRole('button', { name: 'invite.share' })).toBeInTheDocument()
    expect(container.querySelector('[data-sala-button]')).toBeNull()
  })

  it('con `skin="sala"`: SalaButton; copia el enlace y lo anuncia', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { container } = render(<InviteLinkButton path="/es/u/ana?ref=ana&inv=x" skin="sala" />)
    expect(container.querySelector('[data-sala-button]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'invite.share' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('invite.copied'))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/es/u/ana?ref=ana&inv=x`)
  })

  it('con `skin="sala"` y sin portapapeles: enseña el enlace para copiarlo a mano', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true })
    render(<InviteLinkButton path="/es/u/ana" skin="sala" />)
    fireEvent.click(screen.getByRole('button', { name: 'invite.share' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('invite.copyError'))
    expect(screen.getByRole('status')).toHaveTextContent('/es/u/ana')
  })
})
