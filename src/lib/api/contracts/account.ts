// ============================================================
// KULTURA — Contrato de /api/account (saneamiento 6.1 y 7.2)
//
// /api/account                    GET (resumen del borrado) · DELETE (borrar o
//                                 programar) · PATCH (cancelar el borrado)
// /api/account/export             GET → el fichero JSON (descarga, sin `{ data }`)
// /api/account/export/letterboxd  GET ?list=watched|watchlist → CSV (descarga)
// /api/account/import             POST (reimporta el JSON de /export)
// /api/account/import/external    POST (un lote de Letterboxd, MAL, Goodreads…)
//
// Las dos descargas devuelven el fichero tal cual: es lo que el usuario
// guarda y vuelve a subir. Sus errores sí van con `{ error: { code } }`.
// ============================================================

import { z } from 'zod'
import { mediaIdSchema } from '@/lib/api/contracts/common'
import { ACCOUNT_ERRORS } from '@/lib/account/errors'
import { isValidDiaryDate } from '@/lib/library/diary'
import { IMPORT_OUTCOMES, IMPORT_SOURCES } from '@/lib/import/types'
import { BATCH_SIZE } from '@/lib/import/limits'

export { ACCOUNT_ERRORS }

// ── Peticiones ───────────────────────────────────────────────────────────────

/** DELETE /api/account. La contraseña, si la cuenta tiene (vacía = sin ella). */
export const accountDeleteSchema = z.object({
  password: z.string().max(1000).optional(),
})

/** PATCH /api/account. */
export const accountPatchSchema = z.object({
  cancel_deletion: z.literal(true),
})

/** GET /api/account/export/letterboxd. */
export const letterboxdExportQuerySchema = z.object({
  list: z.enum(['watched', 'watchlist']).default('watched'),
})

/** Tope del fichero de /api/account/import: un export de 10.000 títulos con diario ronda unos pocos MB. */
export const KULTURA_IMPORT_MAX_BYTES = 20 * 1024 * 1024

/**
 * POST /api/account/import: el fichero de /export. Solo se exige `library`
 * (un export de Kultura siempre la trae); cada entrada se valida por separado
 * con los esquemas de abajo y la que no vale se salta, no tumba el fichero.
 */
export const kulturaImportSchema = z.looseObject({
  library: z.array(z.unknown()),
  lists: z.unknown().optional(),
  diary: z.unknown().optional(),
})

/** Una entrada de `library`. Título, portada y año se ignoran: la ficha la pone el servidor. */
export const kulturaLibraryEntrySchema = z.object({
  mediaId: mediaIdSchema,
  status: z.enum(['completed', 'in_progress', 'pending', 'abandoned']),
  /** Nota vieja (1-5); sin ella o inválida, `null`. */
  score: z.number().int().min(1).max(5).nullable().optional().catch(null),
  /** F-24: la nota fina se valida en el servicio (`isValidRating10`). */
  rating10: z.unknown().optional(),
  favorite: z.boolean().optional().catch(undefined),
  watchedAt: z.string().nullable().optional().catch(null),
})

/** Una lista de `lists` (solo las propias se recrean). */
export const kulturaListSchema = z.object({
  name: z.string().refine((name) => name.trim() !== ''),
  mediaType: z.string().optional().catch(undefined),
  isCollaborative: z.boolean().optional().catch(undefined),
  items: z.array(z.unknown()).optional().catch(undefined),
})

/** Un apunte de `diary` (el resto lo valida `parseLogInput`). */
export const kulturaDiaryEntrySchema = z.object({
  mediaId: mediaIdSchema,
  watchedOn: z.string().refine(isValidDiaryDate),
  rewatch: z.boolean().optional().catch(undefined),
  rating10: z.unknown().optional(),
  review: z.string().optional().catch(undefined),
  spoiler: z.boolean().optional().catch(undefined),
  privateNote: z.string().optional().catch(undefined),
})

/**
 * POST /api/account/import/external. Cada fila la valida `parseImportItem`
 * (lo que no pasa vuelve como `invalid`, sin tumbar el lote).
 */
export const importBatchSchema = z.object({
  source: z.enum(IMPORT_SOURCES),
  items: z.array(z.unknown()).min(1).max(BATCH_SIZE),
})

// ── Respuestas ───────────────────────────────────────────────────────────────

const transferSchema = z.array(z.object({ name: z.string(), successor: z.string().nullable() }))

/** `data` de GET /api/account. */
export const deletionSummarySchema = z.object({
  library: z.number().int().min(0),
  lists: z.number().int().min(0),
  messages: z.number().int().min(0),
  friends: z.number().int().min(0),
  /** `null`: falló `deletion_preview` y no se sabe a quién pasarían. */
  groups: transferSchema.nullable(),
  sharedLists: transferSchema.nullable(),
  graceDays: z.number().int().min(0),
  deletionRequestedAt: z.string().nullable(),
})

/** `data` de DELETE /api/account. */
export const accountDeleteResultSchema = z.discriminatedUnion('scheduled', [
  z.object({ scheduled: z.literal(true), purgeAt: z.string() }),
  z.object({
    scheduled: z.literal(false),
    transferred: z.object({ groups: z.number(), lists: z.number() }).nullable(),
  }),
])

/** `data` de POST /api/account/import. */
export const kulturaImportResultSchema = z.object({
  libraryImported: z.number().int().min(0),
  librarySkipped: z.number().int().min(0),
  /** Títulos válidos cuyo proveedor no respondió: reimportar los completa. */
  libraryUnresolved: z.number().int().min(0),
  /** Lo que la base rechazó (saneamiento 1.4). */
  libraryFailed: z.number().int().min(0),
  libraryFailedIds: z.array(z.string()),
  listsImported: z.number().int().min(0),
  listItemsFailed: z.number().int().min(0),
  diaryImported: z.number().int().min(0),
  diaryFailed: z.number().int().min(0),
  /** Secciones enteras que no se pudieron escribir (detalle en el log). */
  sectionsFailed: z.array(z.enum(['lists', 'diary'])).optional(),
  /** Siempre 0: una amistad necesita a la otra parte. */
  friendshipsImported: z.literal(0),
})

/** `data` de POST /api/account/import/external. */
export const importBatchResultSchema = z.object({
  results: z.array(
    z.object({
      key: z.string(),
      outcome: z.enum(IMPORT_OUTCOMES),
      mediaId: z.string().optional(),
      title: z.string().optional(),
      year: z.number().optional(),
      by: z.enum(['tmdb', 'imdb', 'tvdb', 'mal', 'isbn', 'title_year', 'title']).optional(),
    })
  ),
  diaryImported: z.number().int().min(0),
})
