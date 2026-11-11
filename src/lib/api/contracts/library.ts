// ============================================================
// KULTURA — Contrato de /api/library (saneamiento 6.1 y 7.2)
// Esquemas de entrada (los valida la ruta) y de salida (los comprueban los
// tests de contrato y, si hace falta, el cliente).
// ============================================================

import { z } from 'zod'
import { mediaIdSchema } from '@/lib/api/contracts/common'
import { isValidRating10 } from '@/lib/library/rating'

export const libraryStatusSchema = z.enum(['completed', 'in_progress', 'pending', 'abandoned'])

const episodeProgressSchema = z.object({
  season: z.number().int().min(0).optional(),
  episode: z.number().int().min(0),
})

/**
 * POST /api/library. Ausente = no se toca; `null` = se quita (saneamiento 1.2).
 * `log` y `progress` traen sus propios parsers (`parseLogInput`,
 * `parseProgressInput`), que dependen del formato del título: aquí solo se
 * exige que, si llegan, sean objetos (o null en `progress`).
 * `mediaCache` se ignora a propósito (SEG-2): z.object descarta lo que no está.
 */
export const libraryPostSchema = z.object({
  mediaId: mediaIdSchema,
  status: libraryStatusSchema,
  score: z.number().int().min(1).max(5).nullable().optional(),
  rating10: z
    .number()
    .refine(isValidRating10, 'rating10 must be between 0.5 and 10 in steps of 0.5')
    .nullable()
    .optional(),
  favorite: z.boolean().optional(),
  watchedAt: z.string().max(40).nullable().optional(),
  episodeProgress: episodeProgressSchema.nullable().optional(),
  log: z.record(z.string(), z.unknown()).nullable().optional(),
  progress: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type LibraryPostInput = z.infer<typeof libraryPostSchema>

export const libraryDeleteSchema = z.object({ mediaId: mediaIdSchema })

// ── Respuestas ───────────────────────────────────────────────────────────────

const nullableNumber = z.number().nullable()

export const progressValueSchema = z.object({
  season: nullableNumber.optional(),
  episode: nullableNumber.optional(),
  chapter: nullableNumber.optional(),
  volume: nullableNumber.optional(),
  page: nullableNumber.optional(),
  percent: nullableNumber.optional(),
  hours: nullableNumber.optional(),
  total: nullableNumber.optional(),
})

export const libraryEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  mediaId: z.string(),
  status: libraryStatusSchema,
  score: nullableNumber,
  rating10: nullableNumber.optional(),
  favorite: z.boolean().optional(),
  watchedAt: z.string().nullable(),
  episodeProgress: episodeProgressSchema.nullable(),
  progress: progressValueSchema.nullable().optional(),
  createdAt: z.string(),
})

export const diaryLogSchema = z.object({
  id: z.string(),
  mediaId: z.string(),
  watchedOn: z.string(),
  rewatch: z.boolean(),
  rating10: nullableNumber,
  review: z.string().nullable(),
  spoiler: z.boolean(),
  privateNote: z.string().nullable(),
  createdAt: z.string(),
})

/** `data` de POST /api/library. */
export const librarySaveResultSchema = z.object({
  entry: libraryEntrySchema,
  /** El apunte del diario creado con la entrada, si se pidió y entró. */
  log: diaryLogSchema.nullable(),
  /** Se pidió un apunte y la entrada se guardó, pero el apunte no. */
  logFailed: z.boolean(),
})

/** `data` de DELETE /api/library. */
export const libraryDeleteResultSchema = z.null()
