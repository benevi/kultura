// WIG (ProfileBio.tsx:89, :91, :58, :108): la bio respeta saltos y parte
// palabras largas; el botón de editar se ve SIEMPRE (con teclado y en el
// móvil) y lleva el foco del sistema; el «+» no entra en el nombre accesible.
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import { ProfileBio } from '@/components/profile/ProfileBio'

describe('ProfileBio (WIG)', () => {
  it('la bio parte palabras largas y respeta los saltos de línea', () => {
    render(<ProfileBio bio={'https://example.com/' + 'a'.repeat(120)} isOwner={false} userId="u" />)
    const p = screen.getByText(/example\.com/)
    expect(p.className).toMatch(/\bbreak-words\b/)
    expect(p.className).toMatch(/\bwhitespace-pre-line\b/)
  })

  it('el botón de editar no se esconde hasta el hover y tiene foco visible', () => {
    render(<ProfileBio bio="Hola" isOwner userId="u" />)
    const button = screen.getByRole('button', { name: 'editBio' })
    expect(button.className).not.toMatch(/opacity-0/)
    expect(button.className).toMatch(/focus-visible:outline-focus-ring/)
  })

  it('sin bio, «Añadir bio» sin el «+» literal en su nombre', () => {
    render(<ProfileBio bio={null} isOwner userId="u" />)
    expect(screen.getByRole('button', { name: 'addBio' })).toBeInTheDocument()
  })

  it('el campo usa el foco y el borde del sistema y no abre el teclado en el móvil', () => {
    render(<ProfileBio bio={null} isOwner userId="u" />)
    fireEvent.click(screen.getByRole('button', { name: 'addBio' }))
    const box = screen.getByRole('textbox')
    expect(box.className).toMatch(/border-field-border/)
    expect(box.className).toMatch(/focus-visible:outline-focus-ring/)
    expect(box).not.toHaveFocus()
  })
})
