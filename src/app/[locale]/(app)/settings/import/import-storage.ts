// ============================================================
// KULTURA — Avance de una importación en este navegador (F-26)
//
// Comodidad por dispositivo, no estado de verdad: si se cierra la pestaña a
// medias, al volver a elegir EL MISMO archivo (misma huella) se sigue por
// donde iba. Si el almacenamiento falla (modo privado, bloqueado) no pasa
// nada: el servidor es idempotente y reimportar no duplica. Solo se guarda
// el resultado por fila (lo que devolvió el servidor), nunca el archivo.
// ============================================================

import type { ImportItemResult, ImportSource } from '@/lib/import/types'

const KEY = 'kultura:import:v1'
/** Pasada una semana, se empieza de cero. */
const MAX_AGE_MS = 7 * 24 * 3600_000

interface Stored {
  fp: string
  source: ImportSource
  savedAt: number
  results: ImportItemResult[]
}

export function loadProgress(fp: string): Map<string, ImportItemResult> | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Stored
    if (stored.fp !== fp || Date.now() - stored.savedAt > MAX_AGE_MS || !Array.isArray(stored.results)) return null
    return new Map(stored.results.map((r) => [r.key, r]))
  } catch {
    return null
  }
}

export function saveProgress(fp: string, source: ImportSource, results: Map<string, ImportItemResult>): void {
  try {
    const stored: Stored = { fp, source, savedAt: Date.now(), results: Array.from(results.values()) }
    window.localStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    // Sin almacenamiento: se puede reimportar igual.
  }
}
