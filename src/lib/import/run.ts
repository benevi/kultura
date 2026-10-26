// ============================================================
// KULTURA — Orquestación de una importación en el navegador (F-26)
//
// Trocea las filas en lotes (≤ 50 filas y ≤ ~400 KB), los manda de uno en uno
// y va contando. Lo que vuelve `pending` (proveedor caído, presupuesto del
// lote agotado) se reintenta al final con espera creciente. Un 429 espera lo
// que diga `Retry-After`; un fallo de red o del servidor se reintenta tres
// veces y, si sigue, se para conservando lo hecho: al volver a elegir el
// mismo archivo se sigue por donde iba (`previous`), y como el servidor es
// idempotente, repetir un lote no duplica nada.
// ============================================================

import { BATCH_SIZE, MAX_BATCH_BYTES, PENDING_ROUNDS } from './limits'
import type {
  ImportBatchRequest,
  ImportBatchResponse,
  ImportItem,
  ImportItemResult,
  ImportOutcome,
  ImportSource,
} from './types'

export type SendResult =
  | { ok: true; data: ImportBatchResponse }
  | { ok: false; status: number; retryAfterSeconds?: number }

export type SendBatch = (request: ImportBatchRequest, signal?: AbortSignal) => Promise<SendResult>

export interface RunProgress {
  /** Filas con resultado definitivo (todo menos `pending`). */
  processed: number
  total: number
  counts: Record<ImportOutcome, number>
  diaryImported: number
  /** Reintentando las pendientes (ronda 1…N) o esperando un 429. */
  phase: 'running' | 'retrying' | 'waiting'
}

export type RunEnd =
  | { status: 'done' | 'aborted'; results: Map<string, ImportItemResult>; diaryImported: number }
  | {
      status: 'error'
      error: 'auth' | 'demo' | 'server' | 'network'
      results: Map<string, ImportItemResult>
      diaryImported: number
    }

export interface RunOptions {
  source: ImportSource
  items: ImportItem[]
  send: SendBatch
  /** Resultados de un intento anterior con el mismo archivo (para retomar). */
  previous?: Map<string, ImportItemResult>
  onProgress?: (progress: RunProgress) => void
  /** Tras cada lote, para guardar el avance. */
  onBatch?: (results: Map<string, ImportItemResult>) => void
  signal?: AbortSignal
  batchSize?: number
  /** Esperas entre rondas de pendientes. */
  pendingDelaysMs?: number[]
  /** Esperas entre reintentos ante un fallo de red o 5xx. */
  retryDelaysMs?: number[]
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

const EMPTY_COUNTS = (): Record<ImportOutcome, number> => ({
  added: 0,
  updated: 0,
  kept: 0,
  unmatched: 0,
  excluded: 0,
  pending: 0,
  invalid: 0,
})

/** Bytes de margen bajo el tope del servidor. */
const BYTE_TARGET = Math.floor(MAX_BATCH_BYTES * 0.8)
const MAX_RATE_LIMIT_WAITS = 5

export function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

/** Lotes por número de filas y por tamaño del JSON. */
export function chunkItems(items: ImportItem[], size = BATCH_SIZE, maxBytes = BYTE_TARGET): ImportItem[][] {
  const out: ImportItem[][] = []
  let current: ImportItem[] = []
  let bytes = 0
  for (const item of items) {
    const b = JSON.stringify(item).length + 1
    if (current.length > 0 && (current.length >= size || bytes + b > maxBytes)) {
      out.push(current)
      current = []
      bytes = 0
    }
    current.push(item)
    bytes += b
  }
  if (current.length > 0) out.push(current)
  return out
}

export function countResults(results: Map<string, ImportItemResult>): Record<ImportOutcome, number> {
  const counts = EMPTY_COUNTS()
  results.forEach((r) => {
    counts[r.outcome]++
  })
  return counts
}

export async function runImport(opts: RunOptions): Promise<RunEnd> {
  const sleep = opts.sleep ?? defaultSleep
  const retryDelays = opts.retryDelaysMs ?? [2000, 5000, 10000]
  const pendingDelays = opts.pendingDelaysMs ?? [3000, 10000, 30000].slice(0, PENDING_ROUNDS)
  const results = new Map<string, ImportItemResult>(opts.previous ?? [])
  // Solo cuentan las filas de este archivo.
  const keys = new Set(opts.items.map((i) => i.key))
  Array.from(results.keys()).forEach((key) => {
    if (!keys.has(key)) results.delete(key)
  })
  let diaryImported = 0
  let phase: RunProgress['phase'] = 'running'

  const report = () => {
    const counts = countResults(results)
    opts.onProgress?.({
      processed: opts.items.length - opts.items.filter((i) => (results.get(i.key)?.outcome ?? 'pending') === 'pending').length,
      total: opts.items.length,
      counts,
      diaryImported,
      phase,
    })
  }
  const end = (status: 'done' | 'aborted'): RunEnd => ({ status, results, diaryImported })
  const fail = (error: 'auth' | 'demo' | 'server' | 'network'): RunEnd => ({ status: 'error', error, results, diaryImported })

  report()
  for (let round = 0; round <= pendingDelays.length; round++) {
    const todo = opts.items.filter((i) => (results.get(i.key)?.outcome ?? 'pending') === 'pending')
    if (todo.length === 0) break
    if (round > 0) {
      phase = 'retrying'
      report()
      await sleep(pendingDelays[round - 1], opts.signal)
    }
    for (const batch of chunkItems(todo, opts.batchSize)) {
      if (opts.signal?.aborted) return end('aborted')
      let attempt = 0
      let rateWaits = 0
      for (;;) {
        let res: SendResult
        try {
          res = await opts.send({ source: opts.source, items: batch }, opts.signal)
        } catch {
          if (opts.signal?.aborted) return end('aborted')
          res = { ok: false, status: 0 }
        }
        if (res.ok) {
          const byKey = new Map(res.data.results.map((r) => [r.key, r]))
          for (const item of batch) results.set(item.key, byKey.get(item.key) ?? { key: item.key, outcome: 'pending' })
          diaryImported += res.data.diaryImported
          break
        }
        if (res.status === 401) return fail('auth')
        if (res.status === 403) return fail('demo')
        if (res.status === 400 || res.status === 413) {
          // El servidor no acepta el lote tal cual: esas filas no se pueden importar.
          for (const item of batch) results.set(item.key, { key: item.key, outcome: 'invalid' })
          break
        }
        if (res.status === 429 && rateWaits < MAX_RATE_LIMIT_WAITS) {
          rateWaits++
          phase = 'waiting'
          report()
          await sleep(Math.min(120, Math.max(1, res.retryAfterSeconds ?? 30)) * 1000, opts.signal)
          if (opts.signal?.aborted) return end('aborted')
          phase = round > 0 ? 'retrying' : 'running'
          continue
        }
        if (attempt >= retryDelays.length) return fail(res.status === 0 ? 'network' : 'server')
        await sleep(retryDelays[attempt++], opts.signal)
        if (opts.signal?.aborted) return end('aborted')
      }
      opts.onBatch?.(results)
      report()
    }
  }
  phase = 'running'
  report()
  return end('done')
}

/** Huella del archivo para saber si es el mismo al retomar (FNV-1a, no criptográfica). */
export function fingerprint(source: ImportSource, items: ImportItem[]): string {
  let h = 0x811c9dc5
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
  }
  feed(source)
  feed(String(items.length))
  for (const item of items) feed(`${item.key}|${item.kind}|${item.title}|${item.year ?? ''}|${item.status}|${item.rating10 ?? ''}`)
  return h.toString(36)
}
