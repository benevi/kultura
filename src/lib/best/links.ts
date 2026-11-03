// ============================================================
// KULTURA — Enlaces de las páginas públicas de /best
//
// Las páginas de /best pintan `<a>` normales y no el `Link` de next-intl
// (REN-9): Next 14 reúne en un mismo manifiesto los componentes cliente de
// todos los layouts de `[locale]` (los grupos como `(app)` no cuentan), y el
// `Link` lo usa también la cabecera con la cuenta abierta, así que cada página que lo
// pinta hereda los trozos de JS de esa cabecera, Supabase incluido. Un `<a>`
// del servidor no carga nada.
// ============================================================

import { bestItemPath, type BestFormat } from "@/lib/best/best-of";
import { localeHref } from "@/lib/best/hrefs";

export { localeHref, loginHref, signUpHref } from "@/lib/best/hrefs";

/**
 * "Guardar" de un título en el HTML: su ficha pública, que es donde está el
 * botón de añadir (sin JS). No va a /login: el ranking no debe sembrar 20
 * enlaces públicos al login (F-15). Con JS, `BestSaveEnhancer` lo convierte
 * en alta + vuelta a guardarlo (`lib/best/save.ts`).
 */
export function saveHref(locale: string, item: { id: string; type: string; externalId?: string }): string {
  return localeHref(locale, bestItemPath(item));
}

/**
 * De dónde salen las notas y las portadas de cada ranking: se cita con un
 * enlace visible junto al criterio (RAWG lo exige; TMDB y AniList, cortesía).
 */
export const BEST_PROVIDER: Record<BestFormat, { name: string; url: string }> = {
  anime: { name: "AniList", url: "https://anilist.co" },
  movie: { name: "TMDB", url: "https://www.themoviedb.org" },
  tv: { name: "TMDB", url: "https://www.themoviedb.org" },
  game: { name: "RAWG", url: "https://rawg.io" },
};
