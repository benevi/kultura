/**
 * Tests unitarios — Rate limiting (sliding window)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, _resetStoreForTests } from '@/lib/rate-limit'

beforeEach(() => {
  _resetStoreForTests()
})

describe('checkRateLimit — comportamiento básico', () => {
  const OPTS = { windowMs: 60_000, max: 3 }

  it('permite peticiones dentro del límite', () => {
    const r1 = checkRateLimit('user1:test', OPTS)
    const r2 = checkRateLimit('user1:test', OPTS)
    const r3 = checkRateLimit('user1:test', OPTS)

    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
    expect(r3.allowed).toBe(true)
  })

  it('bloquea al superar el límite', () => {
    checkRateLimit('user1:test', OPTS)
    checkRateLimit('user1:test', OPTS)
    checkRateLimit('user1:test', OPTS)
    const blocked = checkRateLimit('user1:test', OPTS)

    expect(blocked.allowed).toBe(false)
  })

  it('devuelve remaining correcto', () => {
    const r1 = checkRateLimit('user1:test', OPTS)
    expect(r1.remaining).toBe(2) // max 3, usadas 1

    const r2 = checkRateLimit('user1:test', OPTS)
    expect(r2.remaining).toBe(1)

    const r3 = checkRateLimit('user1:test', OPTS)
    expect(r3.remaining).toBe(0)
  })

  it('retryAfterSeconds es positivo cuando bloqueado', () => {
    checkRateLimit('user1:test', OPTS)
    checkRateLimit('user1:test', OPTS)
    checkRateLimit('user1:test', OPTS)
    const blocked = checkRateLimit('user1:test', OPTS)

    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('retryAfterSeconds es 0 cuando permitido', () => {
    const r = checkRateLimit('user1:test', OPTS)
    expect(r.retryAfterSeconds).toBe(0)
  })
})

describe('checkRateLimit — aislamiento por key', () => {
  const OPTS = { windowMs: 60_000, max: 2 }

  it('claves distintas tienen contadores independientes', () => {
    checkRateLimit('userA:test', OPTS)
    checkRateLimit('userA:test', OPTS)
    const userABlocked = checkRateLimit('userA:test', OPTS)
    const userBAllowed = checkRateLimit('userB:test', OPTS)

    expect(userABlocked.allowed).toBe(false)
    expect(userBAllowed.allowed).toBe(true)
  })

  it('rutas distintas para el mismo usuario son independientes', () => {
    checkRateLimit('user1:library', OPTS)
    checkRateLimit('user1:library', OPTS)
    const libraryBlocked = checkRateLimit('user1:library', OPTS)
    const friendsAllowed = checkRateLimit('user1:friends', OPTS)

    expect(libraryBlocked.allowed).toBe(false)
    expect(friendsAllowed.allowed).toBe(true)
  })
})

describe('checkRateLimit — ventana deslizante', () => {
  it('timestamps caducados no cuentan contra el límite', () => {
    // Ventana muy corta para el test
    const TINY = { windowMs: 50, max: 2 }

    checkRateLimit('user1:tiny', TINY)
    checkRateLimit('user1:tiny', TINY)
    const blocked = checkRateLimit('user1:tiny', TINY)
    expect(blocked.allowed).toBe(false)

    // Esperar a que caduque la ventana
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const allowed = checkRateLimit('user1:tiny', TINY)
        expect(allowed.allowed).toBe(true)
        resolve()
      }, 60) // 60ms > 50ms window
    })
  })
})

describe('checkRateLimit — configuraciones predefinidas', () => {
  it('LIMITS.library tiene windowMs=60000 y max=30', async () => {
    const { LIMITS } = await import('@/lib/rate-limit')
    expect(LIMITS.library.windowMs).toBe(60_000)
    expect(LIMITS.library.max).toBe(30)
  })

  it('LIMITS.friends tiene max=10', async () => {
    const { LIMITS } = await import('@/lib/rate-limit')
    expect(LIMITS.friends.max).toBe(10)
  })

  it('LIMITS.reports tiene max=5', async () => {
    const { LIMITS } = await import('@/lib/rate-limit')
    expect(LIMITS.reports.max).toBe(5)
  })

  it('LIMITS.search tiene max=60', async () => {
    const { LIMITS } = await import('@/lib/rate-limit')
    expect(LIMITS.search.max).toBe(60)
  })
})
