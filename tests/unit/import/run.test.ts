// @vitest-environment node
// F-26 — Orquestación en el navegador: lotes, progreso, reintento de
// pendientes, 429, fallos de red, pausa y reanudación.
import { describe, it, expect, vi } from 'vitest'
import { chunkItems, fingerprint, runImport, type SendBatch } from '@/lib/import/run'
import type { ImportItem, ImportItemResult } from '@/lib/import/types'

const items: ImportItem[] = Array.from({ length: 120 }, (_, i) => ({
  key: String(i),
  kind: 'movie',
  title: `Film ${i}`,
  status: 'completed',
  rating10: null,
  watchedAt: null,
}))

const noSleep = vi.fn(async () => undefined)
const ok = (batch: ImportItem[], outcome: (i: ImportItem) => ImportItemResult['outcome'] = () => 'added') => ({
  ok: true as const,
  data: { results: batch.map((i) => ({ key: i.key, outcome: outcome(i) })), diaryImported: 1 },
})

describe('chunkItems', () => {
  it('≤ 50 filas por lote y corta antes por tamaño', () => {
    expect(chunkItems(items).map((b) => b.length)).toEqual([50, 50, 20])
    const heavy = items.slice(0, 10).map((i) => ({ ...i, logs: [{ watchedOn: '2020-01-01', rewatch: false, rating10: null, review: 'x'.repeat(5000), spoiler: false }] }))
    expect(chunkItems(heavy, 50, 12_000).map((b) => b.length)).toEqual([2, 2, 2, 2, 2])
  })
})

describe('runImport', () => {
  it('manda lotes en orden, cuenta y avisa del progreso', async () => {
    const send = vi.fn<SendBatch>(async (req) => ok(req.items))
    const progress: number[] = []
    const end = await runImport({ source: 'letterboxd', items, send, sleep: noSleep, onProgress: (p) => progress.push(p.processed) })
    expect(end.status).toBe('done')
    expect(send).toHaveBeenCalledTimes(3)
    expect(send.mock.calls[0][0].source).toBe('letterboxd')
    expect(end.results.size).toBe(120)
    expect(end.diaryImported).toBe(3)
    expect(progress).toEqual([0, 50, 100, 120, 120])
  })

  it('las pendientes se reintentan en otra ronda, solo ellas', async () => {
    let round = 0
    const send = vi.fn<SendBatch>(async (req) => {
      round++
      return ok(req.items, (i) => (round <= 3 && Number(i.key) % 10 === 0 ? 'pending' : 'added'))
    })
    const end = await runImport({ source: 'letterboxd', items, send, sleep: noSleep, pendingDelaysMs: [1, 1] })
    expect(send).toHaveBeenCalledTimes(4)
    expect(send.mock.calls[3][0].items.map((i) => i.key)).toEqual(items.filter((i) => Number(i.key) % 10 === 0).map((i) => i.key))
    expect(Array.from(end.results.values()).every((r) => r.outcome === 'added')).toBe(true)
  })

  it('429: espera lo que diga Retry-After y repite el mismo lote', async () => {
    const sleep = vi.fn(async () => undefined)
    const send = vi
      .fn<SendBatch>()
      .mockResolvedValueOnce({ ok: false, status: 429, retryAfterSeconds: 7 })
      .mockImplementation(async (req) => ok(req.items))
    const end = await runImport({ source: 'mal', items: items.slice(0, 10), send, sleep })
    expect(end.status).toBe('done')
    expect(sleep).toHaveBeenCalledWith(7000, undefined)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('fallo de red: 3 reintentos y luego se para conservando lo hecho', async () => {
    const send = vi
      .fn<SendBatch>()
      .mockImplementationOnce(async (req) => ok(req.items))
      .mockRejectedValue(new TypeError('Failed to fetch'))
    const end = await runImport({ source: 'letterboxd', items, send, sleep: noSleep })
    expect(end).toMatchObject({ status: 'error', error: 'network' })
    expect(send).toHaveBeenCalledTimes(5)
    expect(end.results.size).toBe(50)
  })

  it('401 y 403 (demo) paran en seco', async () => {
    for (const [status, error] of [[401, 'auth'], [403, 'demo']] as const) {
      const end = await runImport({ source: 'letterboxd', items, send: async () => ({ ok: false, status }), sleep: noSleep })
      expect(end).toMatchObject({ status: 'error', error })
    }
  })

  it('pausa (abort) entre lotes y reanudación con lo hecho: no repite filas', async () => {
    const controller = new AbortController()
    const send = vi.fn<SendBatch>(async (req) => {
      controller.abort()
      return ok(req.items)
    })
    const first = await runImport({ source: 'letterboxd', items, send, sleep: noSleep, signal: controller.signal })
    expect(first.status).toBe('aborted')
    expect(first.results.size).toBe(50)

    const resend = vi.fn<SendBatch>(async (req) => ok(req.items))
    const second = await runImport({ source: 'letterboxd', items, send: resend, sleep: noSleep, previous: first.results })
    expect(second.status).toBe('done')
    expect(resend.mock.calls.flatMap((c) => c[0].items.map((i) => i.key))).toEqual(items.slice(50).map((i) => i.key))
  })

  it('400/413: las filas de ese lote quedan como no válidas y se sigue', async () => {
    const send = vi
      .fn<SendBatch>()
      .mockResolvedValueOnce({ ok: false, status: 413 })
      .mockImplementation(async (req) => ok(req.items))
    const end = await runImport({ source: 'letterboxd', items, send, sleep: noSleep })
    expect(end.status).toBe('done')
    expect(Array.from(end.results.values()).filter((r) => r.outcome === 'invalid')).toHaveLength(50)
  })

  it('la huella cambia si cambia el archivo', () => {
    expect(fingerprint('letterboxd', items)).toBe(fingerprint('letterboxd', items.map((i) => ({ ...i }))))
    expect(fingerprint('letterboxd', items)).not.toBe(fingerprint('letterboxd', items.slice(1)))
    expect(fingerprint('letterboxd', items)).not.toBe(fingerprint('mal', items))
  })
})
