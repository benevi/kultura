// ============================================================
// KULTURA — Enlaces de /best sin dependencias (aptos para el cliente)
// `links.ts` los reexporta; las islas de cliente importan de aquí para no
// arrastrar `best-of.ts` (caché de Next y proveedores) a su JS.
// ============================================================

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

