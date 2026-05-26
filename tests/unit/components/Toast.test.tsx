import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ToastContainer } from '@/components/ui/Toast'
import type { ToastItem } from '@/components/ui/Toast'

function makeToast(overrides: Partial<ToastItem> = {}): ToastItem {
  return {
    id: '1',
    message: 'Test message',
    type: 'info',
    ...overrides,
  }
}

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renderiza un toast con mensaje y tipo error', () => {
    const dismiss = vi.fn()
    render(
      <ToastContainer
        toasts={[makeToast({ type: 'error', message: 'Algo falló' })]}
        onDismiss={dismiss}
      />
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Algo falló')).toBeInTheDocument()
  })

  it('auto-dismiss: el toast desaparece tras duration ms', () => {
    const dismiss = vi.fn()
    render(
      <ToastContainer
        toasts={[makeToast({ id: '42', duration: 2000 })]}
        onDismiss={dismiss}
      />
    )
    // 2000ms triggers startExit → 150ms exit animation → onDismiss
    act(() => { vi.advanceTimersByTime(2150) })
    expect(dismiss).toHaveBeenCalledWith('42')
  })

  it('dismiss manual: click en × llama onDismiss', () => {
    const dismiss = vi.fn()
    render(
      <ToastContainer
        toasts={[makeToast({ id: '99' })]}
        onDismiss={dismiss}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    // 150ms exit animation before onDismiss
    act(() => { vi.advanceTimersByTime(150) })
    expect(dismiss).toHaveBeenCalledWith('99')
  })

  it('múltiples toasts: 3 toasts visibles simultáneamente', () => {
    const dismiss = vi.fn()
    const toasts: ToastItem[] = [
      makeToast({ id: 'a', message: 'Msg A' }),
      makeToast({ id: 'b', message: 'Msg B' }),
      makeToast({ id: 'c', message: 'Msg C' }),
    ]
    render(<ToastContainer toasts={toasts} onDismiss={dismiss} />)
    expect(screen.getByText('Msg A')).toBeInTheDocument()
    expect(screen.getByText('Msg B')).toBeInTheDocument()
    expect(screen.getByText('Msg C')).toBeInTheDocument()
  })

  it('toast de tipo success tiene color de icono correcto', () => {
    const dismiss = vi.fn()
    render(
      <ToastContainer
        toasts={[makeToast({ type: 'success', message: 'Éxito' })]}
        onDismiss={dismiss}
      />
    )
    const icon = screen.getByText('✓')
    expect(icon.className).toMatch(/green/)
  })
})
