// ============================================================
// KULTURA — Escala de notas (F-24, D-14)
//
// Una sola nota guardada, `rating10`: de 0,5 a 10 en pasos de 0,5. Se
// enseña como medias estrellas sobre 5 (rating10 / 2) o sobre 10, según la
// preferencia de cada persona. La columna vieja `score` (1-5 enteros) se
// sigue rellenando porque la leen el match score, las recomendaciones y los
// perfiles: el disparador `user_media_sync_rating` de la migración
// 20261208240001 y estas funciones redondean IGUAL (mitad hacia arriba, nunca
// por debajo de 1), así cliente, servidor y base dicen lo mismo.
//
// Sin dependencias de servidor: lo usan la API, los diálogos y el importador.
// ============================================================

import type { RatingScale } from '@/types/library'

export const RATING10_MIN = 0.5
export const RATING10_MAX = 10
export const RATING10_STEP = 0.5

/** ¿Es una nota fina válida? (número de 0,5 a 10 en pasos de 0,5) */
export function isValidRating10(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= RATING10_MIN &&
    value <= RATING10_MAX &&
    Number.isInteger(value * 2)
  )
}

/** ¿Es una nota entera válida de la escala vieja? (1-5) */
export function isValidScore5(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

/** 1-5 → 2-10 (sin pérdida). */
export function scoreToRating10(score: number | null | undefined): number | null {
  return isValidScore5(score) ? score * 2 : null
}

/**
 * 0,5-10 → 1-5 para la columna `score`: mitad hacia arriba (9 → 5, 7,5 → 4)
 * y nunca 0 (0,5 → 1), igual que `round()` de Postgres en el disparador.
 */
export function rating10ToScore(rating10: number | null | undefined): number | null {
  if (!isValidRating10(rating10)) return null
  return Math.max(1, Math.min(5, Math.round(rating10 / 2)))
}

/** La nota fina de una entrada: la guardada o, sin la migración, score × 2. */
export function entryRating10(entry: { rating10?: number | null; score: number | null }): number | null {
  if (isValidRating10(entry.rating10)) return entry.rating10
  return scoreToRating10(entry.score)
}

/**
 * Lleva cualquier número al paso de 0,5 más cercano dentro de 0,5-10.
 * `null` si no es un número o es ≤ 0 (sin nota).
 */
export function normalizeRating10(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null
  return Math.min(RATING10_MAX, Math.max(RATING10_MIN, Math.round(n * 2) / 2))
}

/**
 * Nota de Letterboxd (0,5-5 estrellas en pasos de ½, como viene en
 * `ratings.csv` y `diary.csv`: "4.5", "3", vacío) → rating10, SIN PÉRDIDA:
 * 4,5★ → 9. Acepta coma decimal. `null` si está vacía o no es una nota de
 * Letterboxd (no redondea: una nota que no encaja es un dato malo, no se
 * inventa otra).
 */
export function letterboxdToRating10(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const stars = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'))
  if (String(raw).trim() === '' || !Number.isFinite(stars)) return null
  const rating10 = stars * 2
  return isValidRating10(rating10) ? rating10 : null
}

/** rating10 → estrellas sobre 5 que pinta `StarRating` en medias (redondea a ½). */
export function rating10ToHalfStars(rating10: number | null | undefined): number {
  if (!isValidRating10(rating10)) return 0
  return Math.round(rating10) / 2
}

/** Estrellas en medias (0,5-5) → rating10. 0 = sin nota. */
export function halfStarsToRating10(stars: number): number | null {
  return stars > 0 ? normalizeRating10(stars * 2) : null
}

/**
 * Texto corto de una nota según la preferencia: "4,5 ★" o "9/10" ("7,5/10").
 * En estrellas redondea a la media estrella más cercana, IGUAL que el control
 * (`rating10ToHalfStars`): un 7,5 se lee "4 ★" y se ven 4 estrellas, nunca
 * "3,75 ★". Vacío si no hay nota.
 */
export function formatRating(rating10: number | null | undefined, scale: RatingScale, locale: string): string {
  if (!isValidRating10(rating10)) return ''
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  return scale === 'ten' ? `${fmt.format(rating10)}/10` : `${fmt.format(rating10ToHalfStars(rating10))} ★`
}
