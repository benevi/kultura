// ============================================================
// KULTURA — Preferencia de la escala de notas (F-24, servidor)
//
// Nota fina (rating10), favorito y diario, siempre: la bandera
// RATING_SCALE_10 se retiró encendida (saneamiento 11.4).
// ============================================================

import type { User } from '@supabase/supabase-js'
import { isRatingScale, type RatingScale } from '@/types/library'

/** Clave de `user_metadata` donde vive la preferencia ½★ o /10. */
export const RATING_SCALE_KEY = 'rating_scale'

/** Preferencia de la persona; por defecto medias estrellas. */
export function readRatingScale(user: Pick<User, 'user_metadata'> | null | undefined): RatingScale {
  const value = user?.user_metadata?.[RATING_SCALE_KEY]
  return isRatingScale(value) ? value : 'stars'
}
