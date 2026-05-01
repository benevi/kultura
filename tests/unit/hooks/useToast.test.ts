import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useToast } from '@/hooks/useToast'

describe('useToast', () => {
  it('show() añade toast al array', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.show({ message: 'Hola', type: 'info' }) })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('Hola')
  })

  it('dismiss() elimina toast por id', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.show({ message: 'A', type: 'error' }) })
    const id = result.current.toasts[0].id
    act(() => { result.current.dismiss(id) })
    expect(result.current.toasts).toHaveLength(0)
  })

  it('show() con duration personalizada incluye el valor', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.show({ message: 'B', type: 'success', duration: 8000 }) })
    expect(result.current.toasts[0].duration).toBe(8000)
  })

  it('dos llamadas a show() generan IDs distintos', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.show({ message: 'X', type: 'info' })
      result.current.show({ message: 'Y', type: 'info' })
    })
    const [t1, t2] = result.current.toasts
    expect(t1.id).not.toBe(t2.id)
  })

  it('al superar 3 toasts, el más antiguo se elimina', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.show({ message: '1', type: 'info' })
      result.current.show({ message: '2', type: 'info' })
      result.current.show({ message: '3', type: 'info' })
      result.current.show({ message: '4', type: 'info' })
    })
    expect(result.current.toasts).toHaveLength(3)
    expect(result.current.toasts[0].message).toBe('2')
    expect(result.current.toasts[2].message).toBe('4')
  })
})
