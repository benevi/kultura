// ============================================================
// KULTURA — Enlaces de las páginas públicas de /best
//
// Las páginas de /best pintan `<a>` normales y no el `Link` de next-intl
// (REN-9): Next 14 reúne en un mismo manifiesto los componentes cliente de
// todos los layouts de `[locale]` (los grupos como `(app)` no cuentan), y el
// `Link` lo usa también la cabecera con sesión, así que cada página que lo
// pinta hereda los trozos de JS de esa cabecera, Supabase incluido. Un `<a>`
// del servidor no carga nada.
// ============================================================

import { bestItemPath } from "@/lib/best/best-of";

/** Ruta interna (`/best/anime`, `/`) con el prefijo de idioma. */
export function localeHref(locale: string, path: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Alta con vuelta a `next` (ruta con idioma). El login ya sanea `next`. */
export function signUpHref(locale: string, next: string): string {
  return `/${locale}/login?mode=register&next=${encodeURIComponent(next)}`;
}

export function loginHref(locale: string, next: string): string {
  return `/${locale}/login?mode=login&next=${encodeURIComponent(next)}`;
}

/**
 * "Guardar" de un título: alta y vuelta a SU ficha, donde está el botón de
 * añadir a la biblioteca. Con sesión, el login redirige solo a `next`.
 */
export function saveHref(locale: string, item: { id: string; type: string; externalId?: string }): string {
  return signUpHref(locale, localeHref(locale, bestItemPath(item)));
}
