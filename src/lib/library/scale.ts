// ============================================================
// KULTURA — Bandera y preferencia de la escala de notas (F-24, servidor)
//
// RATING_SCALE_10=1 (Vercel) se enciende DESPUÉS de aplicar
// 20261208240001_rating10_logs.sql. Sin ella todo se comporta como antes:
// se escribe `score` y el disparador (si la migración está) rellena rating10.
// Con ella se escribe rating10 y el diario; si aun así la base no tiene las
// columnas o la tabla (bandera encendida antes de tiempo), se detecta por el
// código de error y se vuelve a lo de antes en vez de romper.
// ============================================================

import type { User } from '@supabase/supabase-js'
import { isRatingScale, type RatingScale } from '@/types/library'

export function ratingScale10Enabled(): boolean {
  return process.env.RATING_SCALE_10 === '1'
}

/** Códigos de "esto aún no existe" (tabla, columna o caché de esquema). */
const NOT_MIGRATED = new Set(['42P01', '42703', 'PGRST204', 'PGRST205'])

export function isNotMigrated(error: { code?: string | null } | null | undefined): boolean {
  return !!error && NOT_MIGRATED.has(error.code ?? '')
}

/** Clave de `user_metadata` donde vive la preferencia ½★ o /10. */
export const RATING_SCALE_KEY = 'rating_scale'

/** Preferencia de la persona; por defecto medias estrellas. */
export function readRatingScale(user: Pick<User, 'user_metadata'> | null | undefined): RatingScale {
  const value = user?.user_metadata?.[RATING_SCALE_KEY]
  return isRatingScale(value) ? value : 'stars'
}
