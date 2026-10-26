// ============================================================
// KULTURA — Presupuesto de peticiones a proveedores de un lote (F-26)
//
// Cada lote del importador tiene un tope de peticiones a proveedores y un
// plazo, y cada proveedor un máximo de peticiones simultáneas (TMDB aguanta
// varias; Jikan ~3/s; AniList pide ir de una en una). Al agotarse el
// presupuesto o el plazo, o si el circuito del proveedor está abierto
// (`src/lib/api/http.ts`), la fila no falla: queda `pending` y el navegador
// la reintenta en otro lote. Las peticiones en sí siguen yendo por
// `providerFetch` (plazo, contrato, circuito y caché de una hora).
// ============================================================

import 'server-only'
import { ProviderError, providerCircuitState, type ProviderId } from '@/lib/api/http'
import { PROVIDER_CONCURRENCY } from '../limits'

/** La fila no se pudo resolver AHORA (presupuesto, plazo o proveedor caído). */
export class BudgetExhausted extends Error {
  constructor(readonly reason: 'calls' | 'deadline' | 'provider') {
    super(`import budget: ${reason}`)
    this.name = 'BudgetExhausted'
  }
}

/** Fallos de un proveedor en un lote a partir de los cuales no se le pregunta más. */
const FAILURES_TO_GIVE_UP = 3

class Semaphore {
  private active = 0
  private queue: Array<() => void> = []

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((resolve) => this.queue.push(resolve))
    this.active++
    try {
      return await fn()
    } finally {
      this.active--
      this.queue.shift()?.()
    }
  }
}

export interface BudgetOptions {
  maxCalls: number
  deadline: number
  concurrency?: Partial<Record<ProviderId, number>>
  now?: () => number
}

export class ProviderBudget {
  private calls = 0
  private readonly failures = new Map<ProviderId, number>()
  private readonly down = new Set<ProviderId>()
  private readonly semaphores = new Map<ProviderId, Semaphore>()
  private readonly now: () => number

  constructor(private readonly opts: BudgetOptions) {
    this.now = opts.now ?? Date.now
  }

  get used(): number {
    return this.calls
  }

  get remainingCalls(): number {
    return Math.max(0, this.opts.maxCalls - this.calls)
  }

  get remainingMs(): number {
    return Math.max(0, this.opts.deadline - this.now())
  }

  /** ¿Se ha dado por caído en este lote (o su circuito está abierto)? */
  isDown(provider: ProviderId): boolean {
    return this.down.has(provider) || providerCircuitState(provider) === 'open'
  }

  private semaphore(provider: ProviderId): Semaphore {
    let s = this.semaphores.get(provider)
    if (!s) {
      const max =
        this.opts.concurrency?.[provider] ?? (PROVIDER_CONCURRENCY as Partial<Record<ProviderId, number>>)[provider] ?? 2
      s = new Semaphore(max)
      this.semaphores.set(provider, s)
    }
    return s
  }

  /**
   * Hace una petición a `provider` dentro del presupuesto. Lanza
   * `BudgetExhausted` si no queda o si el proveedor está caído. Un error del
   * proveedor que no sea un "no existe" (404) deja esa fila pendiente, y al
   * tercero el proveedor se da por caído el resto del lote: así no se gasta
   * presupuesto contra un proveedor que no responde.
   */
  async call<T>(provider: ProviderId, fn: () => Promise<T>): Promise<T> {
    return this.semaphore(provider).run(async () => {
      if (this.isDown(provider)) throw new BudgetExhausted('provider')
      if (this.calls >= this.opts.maxCalls) throw new BudgetExhausted('calls')
      if (this.now() >= this.opts.deadline) throw new BudgetExhausted('deadline')
      this.calls++
      try {
        return await fn()
      } catch (e) {
        if (isNotFound(e)) throw e
        const failures = (this.failures.get(provider) ?? 0) + 1
        this.failures.set(provider, failures)
        if (failures >= FAILURES_TO_GIVE_UP) this.down.add(provider)
        throw new BudgetExhausted('provider')
      }
    })
  }
}

/** 404 / 400: el proveedor respondió que no existe; no dice nada de su salud. */
export function isNotFound(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status
  if (e instanceof ProviderError && e.kind === 'http') return status === 404 || status === 400
  return status === 404 || status === 400
}

/** `fn` sobre cada elemento con como mucho `limit` a la vez, conservando el orden. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker))
  return out
}
