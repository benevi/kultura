// F-26 — Avance del importador en este navegador: por cuenta, borrable y sin
// romper si el almacenamiento falla.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearProgress, loadProgress, progressKey, saveProgress } from '@/app/[locale]/(app)/settings/import/import-storage'
import type { ImportItemResult } from '@/lib/import/types'

const results = new Map<string, ImportItemResult>([['0', { key: '0', outcome: 'added', mediaId: 'movie_1' }]])

describe('import-storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('la clave lleva el id del usuario y otra cuenta no ve el avance', () => {
    saveProgress('user-a', 'fp1', 'letterboxd', results)
    expect(progressKey('user-a')).toBe('kultura:import:v2:user-a')
    expect(window.localStorage.getItem('kultura:import:v2:user-a')).toContain('movie_1')
    expect(loadProgress('user-a', 'fp1')?.get('0')?.outcome).toBe('added')
    expect(loadProgress('user-b', 'fp1')).toBeNull()
    // Otro archivo (otra huella) tampoco.
    expect(loadProgress('user-a', 'fp2')).toBeNull()
  })

  it('la clave vieja sin usuario se borra y no se lee', () => {
    window.localStorage.setItem('kultura:import:v1', JSON.stringify({ fp: 'fp1', source: 'mal', savedAt: Date.now(), results: [] }))
    expect(loadProgress('user-a', 'fp1')).toBeNull()
    saveProgress('user-a', 'fp1', 'letterboxd', results)
    expect(window.localStorage.getItem('kultura:import:v1')).toBeNull()
  })

  it('clearProgress («Empezar de cero») borra solo lo de esa cuenta', () => {
    saveProgress('user-a', 'fp1', 'letterboxd', results)
    saveProgress('user-b', 'fp1', 'letterboxd', results)
    clearProgress('user-a')
    expect(loadProgress('user-a', 'fp1')).toBeNull()
    expect(loadProgress('user-b', 'fp1')).not.toBeNull()
  })

  it('pasada una semana se empieza de cero', () => {
    saveProgress('user-a', 'fp1', 'letterboxd', results)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 24 * 3600_000)
    expect(loadProgress('user-a', 'fp1')).toBeNull()
  })

  it('almacenamiento bloqueado (modo privado): ni lanza ni guarda', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => saveProgress('user-a', 'fp1', 'letterboxd', results)).not.toThrow()
    expect(loadProgress('user-a', 'fp1')).toBeNull()
    expect(() => clearProgress('user-a')).not.toThrow()
  })
})
