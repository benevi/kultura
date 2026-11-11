// ============================================================
// KULTURA — Contrato de /api/library (saneamiento 6.1 y 7.2)
// Esquemas de entrada (los valida la ruta) y de salida (los comprueban los
// tests de contrato y, si hace falta, el cliente).
// ============================================================

import { z } from 'zod'
import { mediaIdSchema, uuidSchema } from '@/lib/api/contracts/common'
import { isValidRating10 } from '@/lib/library/rating'
import { isValidDiaryDate } from '@/lib/library/diary'

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

// ── /api/library/diary, /prefs y /progress ──────────────────────────────────

/** GET /api/library/diary: con `mediaId`, los apuntes de ese título; sin él, los últimos. */
export const diaryQuerySchema = z.object({ mediaId: mediaIdSchema.optional() })

/** DELETE /api/library/diary. */
export const diaryDeleteSchema = z.object({ id: uuidSchema })

export const ratingScaleSchema = z.enum(['stars', 'ten'])

/** PUT /api/library/prefs. */
export const prefsPutSchema = z.object({ ratingScale: ratingScaleSchema })

/** GET /api/library/progress. */
export const progressQuerySchema = z.object({ mediaId: mediaIdSchema })

/** POST /api/library/progress: «marcar siguiente» o «completar». */
export const progressPostSchema = z.object({
  mediaId: mediaIdSchema,
  action: z.enum(['next', 'complete']),
  /** Solo en `complete`: apuntarlo en el diario (si F-24 está activo). */
  log: z.boolean().optional(),
  /** Solo en `complete`: AAAA-MM-DD (por defecto, hoy). */
  watchedOn: z.string().refine(isValidDiaryDate, 'watchedOn must be a valid YYYY-MM-DD date').optional(),
})

export type ProgressPostInput = z.infer<typeof progressPostSchema>

/** `data` de GET /api/library/diary. */
export const diaryConfigSchema = z.object({
  enabled: z.boolean(),
  scale: ratingScaleSchema,
  logs: z.array(diaryLogSchema.passthrough()),
})

/** `data` de PUT /api/library/prefs. */
export const prefsResultSchema = z.object({ ratingScale: ratingScaleSchema })

/** `data` de GET /api/library/progress. */
export const progressConfigSchema = z.object({
  enabled: z.boolean(),
  kind: z.enum(['tv', 'anime', 'reading', 'book', 'game']).nullable(),
  progress: progressValueSchema.nullable(),
  total: nullableNumber,
  plan: z.record(z.string(), z.unknown()).nullable(),
  next: z
    .object({ season: z.number(), episode: z.number(), name: z.string().nullable(), airDate: z.string().nullable() })
    .nullable(),
  diary: z.boolean(),
})

/** `data` de POST /api/library/progress con `action: 'next'`. */
export const progressAdvanceResultSchema = z.object({
  progress: progressValueSchema.nullable(),
  status: libraryStatusSchema,
  finished: z.boolean(),
  caughtUp: z.boolean(),
  diary: z.boolean(),
})

/** `data` de POST /api/library/progress con `action: 'complete'`. */
export const progressCompleteResultSchema = z.object({
  status: z.literal('completed'),
  log: diaryLogSchema.nullable(),
  logFailed: z.boolean(),
})
