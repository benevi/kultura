/**
 * ACC-1 / MOV-8 — primitivo `Modal` (Radix Dialog): nombre, foco, Esc,
 * devolución del foco, fondo y hoja con asa. Las pruebas en navegador real
 * (Tab ×20 sin salir) están en tests/e2e/a11y/dialogs.spec.ts.
 */
import { useRef, useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `common.${key}`,
}))

import { Modal, SHEET_DISMISS_PX } from '@/components/ui/Modal'

function Harness({
  variant,
  dismissible = true,
  withInitialFocus = false,
}: {
  variant?: 'dialog' | 'sheet'
  dismissible?: boolean
  withInitialFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const fieldRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Título del diálogo"
        description="Texto de apoyo"
        variant={variant}
        dismissible={dismissible}
        initialFocusRef={withInitialFocus ? fieldRef : undefined}
      >
        <label htmlFor="campo">Campo</label>
        <input id="campo" ref={fieldRef} />
        <button type="button">Acción</button>
      </Modal>
    </>
  )
}

function openWithKeyboard() {
  const opener = screen.getByRole('button', { name: 'Abrir' })
  opener.focus()
  fireEvent.click(opener)
  return opener
}

describe('Modal', () => {
  it('rol dialog con nombre (título) y descripción enlazados, aria-modal', () => {
    render(<Harness />)
    openWithKeyboard()
    const dialog = screen.getByRole('dialog', { name: 'Título del diálogo' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Texto de apoyo')
  })

  it('al abrir, el foco está dentro (primer control: el ×, con nombre traducido)', async () => {
    render(<Harness />)
    openWithKeyboard()
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
    expect(document.activeElement).toHaveAccessibleName('common.close')
  })

  it('initialFocusRef manda sobre el orden', async () => {
    render(<Harness withInitialFocus />)
    openWithKeyboard()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Campo')))
  })

  it('Esc cierra y el foco vuelve al botón que lo abrió', async () => {
    render(<Harness />)
    const opener = openWithKeyboard()
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('el × cierra; el fondo cierra; el panel no', async () => {
    render(<Harness />)
    openWithKeyboard()
    fireEvent.click(screen.getByTestId('modal-panel'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('modal-overlay'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    openWithKeyboard()
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('un arrastre que empieza en el panel y acaba en el fondo NO cierra', () => {
    render(<Harness />)
    openWithKeyboard()
    const overlay = screen.getByTestId('modal-overlay')
    fireEvent.pointerDown(screen.getByTestId('modal-panel'))
    fireEvent.click(overlay)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('dismissible=false: ni Esc ni el fondo cierran (p. ej. guardando)', () => {
    render(<Harness dismissible={false} />)
    openWithKeyboard()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByTestId('modal-overlay'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.close' })).toBeDisabled()
  })

  it('el resto de la página queda fuera del árbol accesible mientras está abierto', () => {
    render(<Harness />)
    openWithKeyboard()
    // Radix marca los hermanos con aria-hidden: el botón de fondo no se ve.
    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument()
  })

  it('hoja (sheet): asa decorativa; arrastrar más del umbral cierra, menos no', async () => {
    render(<Harness variant="sheet" />)
    openWithKeyboard()
    const handle = screen.getByTestId('sheet-handle')
    expect(handle).toHaveAttribute('aria-hidden', 'true')

    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 + SHEET_DISMISS_PX - 20 })
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 100 + SHEET_DISMISS_PX - 20 })
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.pointerDown(handle, { pointerId: 2, clientY: 100 })
    fireEvent.pointerUp(handle, { pointerId: 2, clientY: 100 + SHEET_DISMISS_PX + 10 })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
