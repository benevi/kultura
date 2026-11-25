// ============================================================
// KULTURA — Rutas que no pasan por el trabajo del middleware
//
// El middleware de Vercel corre antes que la caché de la CDN y cuenta en el
// cupo de Fluid Active CPU. Además, lo que añade (la cookie `NEXT_LOCALE` de
// next-intl, la sesión de Supabase refrescada) es una `Set-Cookie`, y una
// respuesta con `Set-Cookie` no se guarda en la CDN: su `s-maxage` no
// serviría de nada.
//
// Aquí van las rutas que no leen sesión ni idioma de la petición (el idioma,
// si lo usan, va en la propia ruta), no pintan HTML (no necesitan el nonce de
// la CSP) y no dependen de quién mira. Para ellas el middleware responde
// `NextResponse.next()` sin más. Apto para el edge: sin imports.
// ============================================================

const LOCALES = "es|en";

/**
 * Tarjetas para compartir enlaces (`opengraph-image` de cualquier segmento,
 * con o sin el id de `generateImageMetadata`) y la tarjeta FIRMADA de una
 * nota (`/u/{usuario}/r/{tipo}/{id}/card/{firma}`). Todas se pintan sin
 * sesión (lo dicen sus cabeceras) y deciden su propia caché.
 */
const OG = "opengraph-image(?:-[a-z0-9]+)?(?:/[^/]+)?";
const SHARE_IMAGE_ROUTES: readonly RegExp[] = [
  // Solo las tarjetas que existen (`src/app/[locale]/**/opengraph-image.tsx`):
  // una ruta inventada sigue por el middleware y acaba en la 404 con nonce.
  new RegExp(`^/(${LOCALES})/${OG}$`),
  new RegExp(`^/(${LOCALES})/login/${OG}$`),
  new RegExp(`^/(${LOCALES})/best/[^/]+/[^/]+/${OG}$`),
  new RegExp(`^/(${LOCALES})/u/[^/]+/${OG}$`),
  new RegExp(`^/(${LOCALES})/u/[^/]+/l/[^/]+/${OG}$`),
  new RegExp(`^/(${LOCALES})/u/[^/]+/r/[^/]+/[^/]+/${OG}$`),
  new RegExp(`^/(${LOCALES})/u/[^/]+/r/[^/]+/[^/]+/card/[^/]+$`),
];

/** ¿Esta ruta (sin query) se sirve sin el trabajo del middleware? */
export function bypassesMiddleware(pathname: string): boolean {
  return SHARE_IMAGE_ROUTES.some((re) => re.test(pathname));
}
