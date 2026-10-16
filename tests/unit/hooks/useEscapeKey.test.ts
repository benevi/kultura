import { renderHook } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { useEscapeKey } from '@/hooks/useEscapeKey'

describe('useEscapeKey', () => {
  it('llama al callback con Escape y no con otras teclas', () => {
    const fn = vi.fn()
    renderHook(() => useEscapeKey(fn))
    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('no escucha cuando active=false', () => {
    const fn = vi.fn()
    renderHook(() => useEscapeKey(fn, false))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('usa el callback más reciente y se desuscribe al desmontar', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, unmount } = renderHook(({ cb }) => useEscapeKey(cb), {
      initialProps: { cb: first },
    })
    rerender({ cb: second })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(second).toHaveBeenCalledTimes(1)
  })
})
