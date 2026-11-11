// ============================================================
// KULTURA — Contrato de /api/lists (saneamiento 6.1, 6.3 y 7.2)
//
// /api/lists                    GET (mis listas) · POST (crear)
// /api/lists/[id]               PATCH (datos, solo el dueño) · DELETE (borrar)
// /api/lists/[id]/items         POST (añadir) · DELETE (quitar) · PATCH (orden o nota)
// /api/lists/[id]/members       POST (invitar) · DELETE (quitar o salir)
//
// Lo que depende de MIXED_LISTS (tipos válidos, descripción y plantilla) lo
// comprueba el servicio: aquí solo la forma.
// ============================================================

import { z } from 'zod'
import { mediaIdSchema, uuidSchema } from '@/lib/api/contracts/common'
import { LIST_ERRORS } from '@/lib/lists/errors'
import { LIST_DESCRIPTION_MAX, LIST_NAME_MAX, LIST_NOTE_MAX, LIST_REORDER_MAX } from '@/lib/social/lists-shared'

export { LIST_ERRORS }

const nameSchema = z.string().trim().min(1, 'name is required').max(LIST_NAME_MAX)
/** Texto opcional: recortado, y vacío = `null` (lo quita), como `optionalText`. */
const optionalTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()

const descriptionSchema = optionalTextSchema(LIST_DESCRIPTION_MAX)

/** GET /api/lists?mediaType=… (un tipo que no existe no filtra, como siempre). */
export const listsQuerySchema = z.object({ mediaType: z.string().max(20).optional() })

/** POST /api/lists. */
export const listCreateSchema = z.object({
  name: nameSchema,
  mediaType: z.string().max(20),
  isCollaborative: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  description: descriptionSchema.optional(),
  template: z.string().max(20).nullable().optional(),
})
export type ListCreateInput = z.infer<typeof listCreateSchema>

/** PATCH /api/lists/[id]: al menos uno de los tres. */
export const listPatchSchema = z
  .object({
    isPublic: z.boolean().optional(),
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
  })
  .refine((b) => b.isPublic !== undefined || b.name !== undefined || b.description !== undefined, {
    message: 'nothing to update',
  })
export type ListPatchInput = z.infer<typeof listPatchSchema>

/** POST /api/lists/[id]/items (`mediaCache` se ignora, SEG-2). */
export const itemAddSchema = z.object({ mediaId: mediaIdSchema })

/** DELETE /api/lists/[id]/items. */
export const itemRemoveSchema = z.object({ itemId: uuidSchema })

/** PATCH /api/lists/[id]/items: orden manual completo o nota de un título (F-25). */
export const itemsPatchSchema = z.union([
  z.object({
    order: z
      .array(uuidSchema)
      .min(1)
      .max(LIST_REORDER_MAX)
      .refine((ids) => new Set(ids).size === ids.length, 'order has duplicates'),
  }),
  z.object({
    itemId: uuidSchema,
    note: optionalTextSchema(LIST_NOTE_MAX),
  }),
])
export type ItemsPatchInput = z.infer<typeof itemsPatchSchema>

/** POST y DELETE /api/lists/[id]/members. */
export const memberSchema = z.object({ userId: uuidSchema })

// ── Respuestas ───────────────────────────────────────────────────────────────

export const listRowSchema = z
  .object({
    id: z.string(),
    owner_id: z.string(),
    name: z.string(),
    media_type: z.string(),
    is_collaborative: z.boolean().nullable(),
    is_public: z.boolean().nullable(),
    created_at: z.string(),
    description: z.string().nullable().optional(),
    template: z.string().nullable().optional(),
  })
  .passthrough()

/** `data` de GET /api/lists. */
export const listsResultSchema = z.array(listRowSchema)

/** `data` de POST /api/lists (201). */
export const listCreateResultSchema = listRowSchema

/** `data` de PATCH /api/lists/[id]: lo que cambió. */
export const listPatchResultSchema = z.object({
  isPublic: z.boolean().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
})

/** `data` de POST /api/lists/[id]/items (201). */
export const itemAddResultSchema = z.object({
  id: z.string(),
  list_id: z.string(),
  media_id: z.string(),
  added_by: z.string().nullable(),
  added_at: z.string(),
})

/** `data` de PATCH /api/lists/[id]/items. */
export const itemsPatchResultSchema = z.union([
  z.object({ moved: z.number().nullable() }),
  z.object({ note: z.string().nullable() }),
])
