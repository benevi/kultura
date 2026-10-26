// ============================================================
// KULTURA — Avisos (ACC-11, MOV-6, V9): regiones vivas persistentes, errores
// ≥ 6 s o persistentes, pausa con ratón/foco, por encima de la BottomNav.
// ============================================================

import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'dismiss' ? 'Cerrar aviso' : key),
}))

import { ToastContainer, toastDuration, type ToastItem } from '@/components/ui/Toast'
import { ToastProvider, useToastContext } from '@/components/ui/ToastProvider'

function toast(o: Partial<ToastItem> = {}): ToastItem {
  return { id: 't1', message: 'Hola', type: 'info', ...o }
}

describe('ToastContainer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('las dos regiones vivas existen aunque no haya avisos', () => {
    render(<ToastContainer toasts={[]} onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(document.querySelector('[aria-live="assertive"]')).not.toBeNull()
  })

  it('ningún aviso lleva role="alert" propio; el error va a la región assertive', () => {
    render(<ToastContainer toasts={[toast({ type: 'error', message: 'Falló' })]} onDismiss={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
    const region = document.querySelector('[aria-live="assertive"]')!
    expect(region).toHaveTextContent('Falló')
    expect(screen.getByRole('status')).not.toHaveTextContent('Falló')
  })

  // DIS-14: «Deshacer» dentro del aviso; con acción dura 8 s y se cierra al pulsarla.
  it('un aviso con acción pinta su botón, la ejecuta y se cierra', () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(<ToastContainer toasts={[toast({ message: 'Quitado', action: { label: 'Deshacer', onAction } })]} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(200) })
    expect(onDismiss).toHaveBeenCalledWith('t1')
    expect(toastDuration({ type: 'success', action: { label: 'x', onAction } })).toBe(8000)
    expect(toastDuration({ type: 'success' })).toBe(4000)
  })

  it('onExpire: al irse solo o al cerrarlo, una vez; nunca si se pulsa la acción', () => {
    const onExpire = vi.fn()
    const { unmount } = render(
      <ToastContainer toasts={[toast({ action: { label: 'Deshacer', onAction: vi.fn(), onExpire } })]} onDismiss={vi.fn()} />
    )
    act(() => { vi.advanceTimersByTime(8000) })
    expect(onExpire).toHaveBeenCalledTimes(1)
    unmount()

    const onExpire2 = vi.fn()
    render(<ToastContainer toasts={[toast({ id: 't2', action: { label: 'Deshacer', onAction: vi.fn(), onExpire: onExpire2 } })]} onDismiss={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(onExpire2).not.toHaveBeenCalled()
  })

  it('un aviso normal va a la región status (educada)', () => {
    render(<ToastContainer toasts={[toast({ message: 'Guardado' })]} onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Guardado')
  })

  // Regresión: el error duraba los 4 s por defecto, como cualquier aviso.
  it('un error sin duración sigue en pantalla a los 6 s', () => {
    const dismiss = vi.fn()
    render(<ToastContainer toasts={[toast({ type: 'error' })]} onDismiss={dismiss} />)
    act(() => { vi.advanceTimersByTime(6150) })
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('un error nunca dura menos de 6 s aunque se pida menos', () => {
    expect(toastDuration({ type: 'error', duration: 2000 })).toBe(6000)
    expect(toastDuration({ type: 'error' })).toBeGreaterThanOrEqual(6000)
    expect(toastDuration({ type: 'info' })).toBe(4000)
  })

  it('duration Infinity: persistente hasta cerrarlo', () => {
    const dismiss = vi.fn()
    render(<ToastContainer toasts={[toast({ type: 'error', duration: Infinity })]} onDismiss={dismiss} />)
    act(() => { vi.advanceTimersByTime(10 * 60_000) })
    expect(dismiss).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    act(() => { vi.advanceTimersByTime(150) })
    expect(dismiss).toHaveBeenCalledWith('t1')
  })

  it('con el ratón encima no se cierra; al salir, sigue la cuenta', () => {
    const dismiss = vi.fn()
    render(<ToastContainer toasts={[toast({ duration: 2000, message: 'Hover' })]} onDismiss={dismiss} />)
    const el = screen.getByText('Hover').closest('[data-toast-type]')!
    act(() => { vi.advanceTimersByTime(1000) })
    fireEvent.mouseEnter(el)
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(dismiss).not.toHaveBeenCalled()
    fireEvent.mouseLeave(el)
    act(() => { vi.advanceTimersByTime(1000 + 150) })
    expect(dismiss).toHaveBeenCalledWith('t1')
  })

  it('con el foco dentro no se cierra', () => {
    const dismiss = vi.fn()
    render(<ToastContainer toasts={[toast({ duration: 2000 })]} onDismiss={dismiss} />)
    fireEvent.focus(screen.getByRole('button', { name: 'Cerrar aviso' }))
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('el botón de cerrar está traducido y mide 44×44', () => {
    render(<ToastContainer toasts={[toast()]} onDismiss={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Cerrar aviso' })
    expect(btn.className).toContain('w-11')
    expect(btn.className).toContain('h-11')
  })

  // Regresión (V9): `fixed bottom-4 right-4` tapaba la BottomNav en móvil.
  it('en móvil se coloca por encima de la BottomNav y de la zona segura', () => {
    render(<ToastContainer toasts={[toast()]} onDismiss={vi.fn()} />)
    const cls = screen.getByTestId('toast-viewport').className
    expect(cls).toContain('bottom-[calc(4.5rem+env(safe-area-inset-bottom))]')
    expect(cls).toContain('md:bottom-4')
  })

  it('deslizar el aviso con el dedo lo descarta', () => {
    const dismiss = vi.fn()
    render(<ToastContainer toasts={[toast({ message: 'Swipe' })]} onDismiss={dismiss} />)
    const el = screen.getByText('Swipe').closest('[data-toast-type]')!
    fireEvent.pointerDown(el, { pointerType: 'touch', pointerId: 1, clientX: 100 })
    fireEvent.pointerMove(el, { pointerType: 'touch', pointerId: 1, clientX: 220 })
    fireEvent.pointerUp(el, { pointerType: 'touch', pointerId: 1, clientX: 220 })
    act(() => { vi.advanceTimersByTime(150) })
    expect(dismiss).toHaveBeenCalledWith('t1')
  })
})

describe('ToastProvider.showError', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function Trigger({ persistent }: { persistent?: boolean }) {
    const { showError } = useToastContext()
    return <button type="button" onClick={() => showError('El proveedor no responde', { persistent })}>fallar</button>
  }

  it('pinta el error en la región assertive y sigue a los 6 s', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fallar'))
    act(() => { vi.advanceTimersByTime(6000) })
    expect(document.querySelector('[aria-live="assertive"]')).toHaveTextContent('El proveedor no responde')
  })

  it('persistent: sigue ahí a los 5 minutos', () => {
    render(<ToastProvider><Trigger persistent /></ToastProvider>)
    fireEvent.click(screen.getByText('fallar'))
    act(() => { vi.advanceTimersByTime(5 * 60_000) })
    expect(screen.getByText('El proveedor no responde')).toBeInTheDocument()
  })
})
