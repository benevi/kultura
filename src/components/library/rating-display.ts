// ============================================================
// KULTURA — Nota de la persona a la vista: «8,5 de 10» o «4,5 de 5»
//
// Una sola forma de pintar TU nota en la ficha, el diario y la biblioteca:
// el número con el formato del idioma (Intl, 8,5 / 8.5) y su escala aparte,
// para que la cifra pueda ir en Lilita y la escala en pequeño. Las medias
// estrellas se redondean igual que el control (`rating10ToHalfStars`).
// ============================================================

import { isValidRating10, rating10ToHalfStars } from '@/lib/library/rating'
import type { RatingScale } from '@/types/library'

/** `legacy`: estrellas enteras de siempre (sin RATING_SCALE_10). Se pinta como `stars`. */
export type DisplayScale = RatingScale | 'legacy'

export interface RatingParts {
  /** La cifra ya formateada («8,5», «4»). */
  value: string
  /** Máximo de la escala (10 o 5). */
  max: 10 | 5
}

const cache = new Map<string, Intl.NumberFormat>()

function fmt(locale: string): Intl.NumberFormat {
  let f = cache.get(locale)
  if (!f) {
    f = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
    cache.set(locale, f)
  }
  return f
}

/** Cifra y escala de una nota 0,5-10, o `null` si no hay nota. */
export function ratingParts(rating10: number | null | undefined, scale: DisplayScale, locale: string): RatingParts | null {
  if (!isValidRating10(rating10)) return null
  if (scale === 'ten') return { value: fmt(locale).format(rating10), max: 10 }
  return { value: fmt(locale).format(rating10ToHalfStars(rating10)), max: 5 }
}
