// ============================================================
// KULTURA — Avance de una importación en este navegador (F-26)
//
// Comodidad por dispositivo, no estado de verdad: si se cierra la pestaña a
// medias, al volver a elegir EL MISMO archivo (misma huella) se sigue por
// donde iba. Si el almacenamiento falla (modo privado, bloqueado) no pasa
// nada: el servidor es idempotente y reimportar no duplica. Solo se guarda
// el resultado por fila (lo que devolvió el servidor), nunca el archivo.
// La clave lleva el id del usuario: en un navegador compartido, otra cuenta
// no ve ni retoma el avance de la anterior. "Empezar de cero" lo borra.
// ============================================================

import type { ImportItemResult, ImportSource } from '@/lib/import/types'

const PREFIX = 'kultura:import:v2:'
/** Clave sin usuario de la primera versión: se borra al guardar. */
const LEGACY_KEY = 'kultura:import:v1'

export function progressKey(userId: string): string {
  return `${PREFIX}${userId}`
}
/** Pasada una semana, se empieza de cero. */
const MAX_AGE_MS = 7 * 24 * 3600_000

interface Stored {
  fp: string
  source: ImportSource
  savedAt: number
  results: ImportItemResult[]
}

export function loadProgress(userId: string, fp: string): Map<string, ImportItemResult> | null {
  try {
    const raw = window.localStorage.getItem(progressKey(userId))
    if (!raw) return null
    const stored = JSON.parse(raw) as Stored
    if (stored.fp !== fp || Date.now() - stored.savedAt > MAX_AGE_MS || !Array.isArray(stored.results)) return null
    return new Map(stored.results.map((r) => [r.key, r]))
  } catch {
    return null
  }
}

export function saveProgress(
  userId: string,
  fp: string,
  source: ImportSource,
  results: Map<string, ImportItemResult>
): void {
  try {
    const stored: Stored = { fp, source, savedAt: Date.now(), results: Array.from(results.values()) }
    window.localStorage.setItem(progressKey(userId), JSON.stringify(stored))
    window.localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Sin almacenamiento: se puede reimportar igual.
  }
}

/** Olvida el avance guardado de esta cuenta ("Empezar de cero"). */
export function clearProgress(userId: string): void {
  try {
    window.localStorage.removeItem(progressKey(userId))
    window.localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Nada que borrar o almacenamiento bloqueado.
  }
}
