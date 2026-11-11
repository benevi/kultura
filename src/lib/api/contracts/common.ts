// ============================================================
// KULTURA — Esquemas compartidos de la API (saneamiento 6.1)
// ============================================================

import { z } from 'zod'

/**
 * Id de un título: `{tipo}_{idExterno}` (`movie_603`, `book_ol_OL123W`…).
 * Un único esquema para todas las rutas: antes cada una lo validaba a su
 * manera (o no lo validaba) y llegaban ids que rompían la FK de `media`.
 */
export const mediaIdSchema = z
  .string()
  .max(200)
  .regex(/^[a-z]+_.+$/, 'mediaId must follow the format "{type}_{externalId}"')

export type MediaId = z.infer<typeof mediaIdSchema>

/** UUID de una fila (lista, grupo, mensaje…). */
export const uuidSchema = z.string().uuid()
