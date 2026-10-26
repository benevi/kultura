// @vitest-environment node
/**
 * JSON en streaming (exportación de datos): el texto es idéntico al de
 * JSON.stringify y sale por trozos, sin formar nunca la cadena entera.
 */
import { describe, it, expect } from 'vitest'
import { jsonParts, jsonStream } from '@/lib/utils/json-stream'

async function readAll(stream: ReadableStream<Uint8Array>): Promise<{ text: string; chunks: number }> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let chunks = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks++
    text += decoder.decode(value, { stream: true })
  }
  return { text: text + decoder.decode(), chunks }
}

const SAMPLES: unknown[] = [
  {},
  [],
  null,
  'texto con "comillas", \\ y saltos\n',
  { a: 1, b: [1, 'dos', null, { c: true }], d: { e: [] }, f: undefined, g: () => 1 },
  [undefined, () => 1, 3, { x: undefined }],
  { fecha: new Date('2026-10-26T10:00:00Z'), anidado: { profundo: { mas: [1, 2, { y: 'z' }] } } },
  { emoji: 'ñandú ★ 日本', vacío: '' },
  { recommendations: { sent: [{ id: 'r1' }], received: [] }, truncated: ['messagesReceived'] },
]

describe('jsonStream', () => {
  it.each(SAMPLES.map((s) => [JSON.stringify(s)?.slice(0, 40) ?? String(s), s]))(
    'mismo texto que JSON.stringify: %s',
    async (_label, sample) => {
      expect(Array.from(jsonParts(sample)).join('')).toBe(JSON.stringify(sample))
      expect((await readAll(jsonStream(sample, { chunkChars: 8 }))).text).toBe(JSON.stringify(sample))
    }
  )

  it('un export grande sale en muchos trozos y se reconstruye igual', async () => {
    const big = { messages: Array.from({ length: 20_000 }, (_, i) => ({ id: `m${i}`, content: 'x'.repeat(100) })) }
    const { text, chunks } = await readAll(jsonStream(big))
    expect(chunks).toBeGreaterThan(20)
    expect(text.length).toBe(JSON.stringify(big).length)
    expect(JSON.parse(text)).toEqual(big)
  })
})
