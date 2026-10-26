// ============================================================
// KULTURA — Importadores de otras apps (F-26, D-15): tipos comunes
//
// El archivo se lee EN EL NAVEGADOR (parse-file.ts): al servidor solo viaja,
// por lotes, lo imprescindible de cada fila (título, año, ids externos, nota,
// fechas y, del diario, la reseña). Así el archivo entero (con el nombre de
// usuario de MAL, notas privadas que no se importan, etc.) nunca sale del
// dispositivo, y el servidor no guarda nada que no vaya a la biblioteca.
//
// Sin dependencias de servidor: lo usan el cliente, la API y los tests.
// ============================================================

import type { LibraryStatus } from '@/types/library'

/** Apps de origen, en el orden de D-15 (+ IMDb, que sale gratis con TMDB find). */
export const IMPORT_SOURCES = ['letterboxd', 'mal', 'goodreads', 'imdb', 'tvtime'] as const
export type ImportSource = (typeof IMPORT_SOURCES)[number]

export function isImportSource(value: unknown): value is ImportSource {
  return typeof value === 'string' && (IMPORT_SOURCES as readonly string[]).includes(value)
}

/** Formatos de KULTURA a los que puede ir una fila importada. */
export const IMPORT_KINDS = ['movie', 'tv', 'anime', 'manga', 'book'] as const
export type ImportKind = (typeof IMPORT_KINDS)[number]

/** Ids externos que trae el archivo (los que haya). */
export interface ImportIds {
  /** TMDB (CSV en formato de importación de Letterboxd, como el que exporta KULTURA). */
  tmdb?: number
  /** IMDb `tt…` (IMDb, formato de importación de Letterboxd). */
  imdb?: string
  /** TheTVDB (TV Time). */
  tvdb?: number
  /** MyAnimeList (MAL). */
  mal?: number
  /** ISBN-13 / ISBN-10 sin guiones (Goodreads), el primero el mejor. */
  isbn?: string[]
}

/** Un visionado, lectura o partida con fecha (diario, F-24). */
export interface ImportLog {
  /** AAAA-MM-DD */
  watchedOn: string
  rewatch: boolean
  rating10: number | null
  review: string | null
  spoiler: boolean
}

/** Una fila ya normalizada, lista para mandar al servidor. */
export interface ImportItem {
  /** Posición en el archivo (estable entre reintentos y para el informe). */
  key: string
  kind: ImportKind
  title: string
  year?: number
  /** Autor (libros): desempata cuando no hay ISBN. */
  author?: string
  ids?: ImportIds
  status: LibraryStatus
  /** 0,5-10 en pasos de 0,5 (D-14), sin pérdida desde ½★ o /10. */
  rating10: number | null
  /** AAAA-MM-DD (última vez que se terminó). */
  watchedAt: string | null
  logs?: ImportLog[]
}

/**
 * Resultado de cada fila:
 * - added: entra nueva en la biblioteca.
 * - updated: ya estaba y se ha completado (nota, fecha o estado que avanza).
 * - kept: ya estaba igual o con más información; no se toca.
 * - unmatched: se ha buscado y no hay un título que encaje con seguridad.
 * - excluded: encaja con un título para adultos (fuera del catálogo).
 * - pending: el proveedor no respondió o se acabó el presupuesto de este
 *   lote; se reintenta sola (y al reimportar).
 * - invalid: la fila no trae lo mínimo (título, estado…).
 */
export const IMPORT_OUTCOMES = ['added', 'updated', 'kept', 'unmatched', 'excluded', 'pending', 'invalid'] as const
export type ImportOutcome = (typeof IMPORT_OUTCOMES)[number]

/** Cómo se emparejó (para el informe y para medir la calidad). */
export type MatchMethod = 'tmdb' | 'imdb' | 'tvdb' | 'mal' | 'isbn' | 'title_year' | 'title'

export interface ImportItemResult {
  key: string
  outcome: ImportOutcome
  mediaId?: string
  /** Título y año del catálogo con el que se emparejó (para revisar el informe). */
  title?: string
  year?: number
  by?: MatchMethod
}

/** Cuerpo de POST /api/account/import/external. */
export interface ImportBatchRequest {
  source: ImportSource
  items: ImportItem[]
}

export interface ImportBatchResponse {
  results: ImportItemResult[]
  /** Apuntes de diario creados en este lote (0 sin F-24 activa). */
  diaryImported: number
}

/** Qué contiene el archivo, para la vista previa. */
export interface ImportSummary {
  total: number
  byStatus: Record<LibraryStatus, number>
  byKind: Partial<Record<ImportKind, number>>
  rated: number
  logs: number
}

export type ImportWarning =
  /** Filas sin título o con datos que no se pueden usar. */
  | { code: 'skipped_rows'; count: number }
  /** El archivo trae más filas de las que se importan de una vez. */
  | { code: 'truncated'; count: number; max: number }
  /** Un CSV de Letterboxd sin nombre reconocible: ¿vistas o pendientes? */
  | { code: 'ambiguous_list' }
  /** Dentro del ZIP no había ningún CSV que sepamos leer. */
  | { code: 'no_known_files' }

export interface ParsedImport {
  source: ImportSource
  items: ImportItem[]
  warnings: ImportWarning[]
  /** Archivos del ZIP o sueltos que se han usado. */
  files: string[]
}

export type ParseErrorCode =
  | 'too_large'
  | 'unknown_format'
  | 'empty'
  | 'mixed_sources'
  | 'corrupt'
  | 'too_many_files'

export class ImportParseError extends Error {
  readonly code: ParseErrorCode

  constructor(code: ParseErrorCode, message = code) {
    super(message)
    this.name = 'ImportParseError'
    this.code = code
  }
}
