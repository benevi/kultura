// ============================================================
// Saneamiento 6.4: las fuentes de las tarjetas (Google Fonts) se piden con
// tope de tiempo y un reintento ante red o 5xx; si no salen, null (la
// tarjeta sale con la fuente por defecto).
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FONT_TIMEOUT_MS, loadFont } from '@/lib/og/brand'

const CSS = "@font-face { src: url(https://fonts.gstatic.com/x.ttf) format('truetype'); }"
const css = () => new Response(CSS, { status: 200 })
const font = () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

describe('loadFont', () => {
  it('pide hoja y fuente con caché y señal de tiempo', async () => {
    fetchMock.mockResolvedValueOnce(css()).mockResolvedValueOnce(font())
    const f = await loadFont('Figtree', 700, 'Hola')
    expect(f?.name).toBe('Figtree')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      expect(init.next).toEqual({ revalidate: 7 * 86400 })
    }
    expect(FONT_TIMEOUT_MS).toBeGreaterThan(0)
  })

  it('reintenta una vez ante un 5xx o un fallo de red', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(css())
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(font())
    expect(await loadFont('Figtree', 700, 'Hola')).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('no reintenta un 4xx ni un timeout; devuelve null', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 400 }))
    expect(await loadFont('Figtree', 700, 'Hola')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockReset()
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
    expect(await loadFont('Figtree', 700, 'Hola')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('dos 5xx seguidos: null, sin más intentos', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 502 }))
    expect(await loadFont('Figtree', 700, 'Hola')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
